package com.pulse.app.detection;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageFormat;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.graphics.YuvImage;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.util.Size;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.LifecycleService;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.objects.DetectedObject;
import com.google.mlkit.vision.objects.ObjectDetection;
import com.google.mlkit.vision.objects.ObjectDetector;
import com.google.mlkit.vision.objects.defaults.ObjectDetectorOptions;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * CameraDetectionService
 *
 * A LifecycleService (ForegroundService) that:
 * 1. Opens the camera via CameraX even when the screen is off / app is closed
 * 2. Runs ML Kit real-time object detection on every frame (~30fps)
 * 3. Calls Claude API every 1s for objects outside ML Kit's detection classes
 * 4. Fires system notifications for unusual/found events
 * 5. Broadcasts results back to CameraDetectionPlugin → React via Capacitor
 */
public class CameraDetectionService extends LifecycleService {

    private static final String TAG              = "PulseDetection";
    private static final String CHANNEL_ID       = "pulse_detection_channel";
    private static final String CHANNEL_ALERT_ID = "pulse_alert_channel";
    private static final int    NOTIF_ID         = 1001;

    // ── Public broadcast action ───────────────────────────────────────────────
    public static final String ACTION_DETECTION_RESULT = "com.pulse.app.DETECTION_RESULT";
    public static final String ACTION_ALERT            = "com.pulse.app.ALERT";
    public static final String EXTRA_DETECTIONS        = "detections";
    public static final String EXTRA_ALERT_MSG         = "alert_msg";
    public static final String EXTRA_ALERT_OBJECT      = "alert_object";

    // ── Binder for bound-service access ──────────────────────────────────────
    private final IBinder binder = new LocalBinder();
    public class LocalBinder extends Binder {
        public CameraDetectionService getService() { return CameraDetectionService.this; }
    }
    @Override public IBinder onBind(@NonNull Intent intent) {
        super.onBind(intent);
        return binder;
    }

    // ── State ─────────────────────────────────────────────────────────────────
    private ObjectDetector           mlKitDetector;
    private ProcessCameraProvider    cameraProvider;
    private ExecutorService          cameraExecutor;
    private Handler                  mainHandler;
    private ClaudeScanner            claudeScanner;
    private NotificationManager      notifManager;

    // Registered objects — set via setRegisteredObjects() from the plugin
    private List<RegisteredObject>   registeredObjects = new ArrayList<>();
    private String                   currentRoom       = "Unknown Room";
    private boolean                  isRunning         = false;

    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        mainHandler   = new Handler(Looper.getMainLooper());
        cameraExecutor = Executors.newSingleThreadExecutor();
        notifManager  = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        createNotificationChannels();
        initMLKit();
        claudeScanner = new ClaudeScanner(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        super.onStartCommand(intent, flags, startId);
        startForeground(NOTIF_ID, buildForegroundNotification("Pulse is monitoring your objects…"));
        if (!isRunning) startCamera();
        return START_STICKY; // restart if killed
    }

    @Override
    public void onDestroy() {
        stopDetection();
        cameraExecutor.shutdown();
        if (mlKitDetector != null) try { mlKitDetector.close(); } catch (Exception ignored) {}
        super.onDestroy();
    }

    // ── ML Kit setup ──────────────────────────────────────────────────────────

    private void initMLKit() {
        ObjectDetectorOptions options = new ObjectDetectorOptions.Builder()
            .setDetectorMode(ObjectDetectorOptions.STREAM_MODE) // real-time
            .enableMultipleObjects()
            .enableClassification()
            .build();
        mlKitDetector = ObjectDetection.getClient(options);
    }

    // ── Camera ────────────────────────────────────────────────────────────────

    private void startCamera() {
        isRunning = true;
        ListenableFuture<ProcessCameraProvider> future =
            ProcessCameraProvider.getInstance(this);

        future.addListener(() -> {
            try {
                cameraProvider = future.get();
                bindCameraUseCases();
            } catch (Exception e) {
                Log.e(TAG, "Camera provider failed: " + e.getMessage());
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void bindCameraUseCases() {
        CameraSelector cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA;

        ImageAnalysis imageAnalysis = new ImageAnalysis.Builder()
            .setTargetResolution(new Size(640, 480))
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST) // don't queue frames
            .build();

        imageAnalysis.setAnalyzer(cameraExecutor, this::analyzeFrame);

        try {
            cameraProvider.unbindAll();
            cameraProvider.bindToLifecycle(this, cameraSelector, imageAnalysis);
            Log.i(TAG, "CameraX bound successfully");
        } catch (Exception e) {
            Log.e(TAG, "Camera bind failed: " + e.getMessage());
        }
    }

    private void stopDetection() {
        isRunning = false;
        if (cameraProvider != null) {
            try { cameraProvider.unbindAll(); } catch (Exception ignored) {}
        }
        claudeScanner.stop();
    }

    // ── Frame analysis ────────────────────────────────────────────────────────

    private void analyzeFrame(@NonNull ImageProxy imageProxy) {
        if (!isRunning) { imageProxy.close(); return; }

        InputImage inputImage;
        try {
            inputImage = InputImage.fromMediaImage(
                imageProxy.getImage(),
                imageProxy.getImageInfo().getRotationDegrees()
            );
        } catch (Exception e) {
            imageProxy.close();
            return;
        }

        mlKitDetector.process(inputImage)
            .addOnSuccessListener(detectedObjects -> {
                handleMLKitResults(detectedObjects);
                // Pass compressed frame to Claude scanner for non-ML-Kit objects
                claudeScanner.submitFrame(imageProxy, registeredObjects);
            })
            .addOnFailureListener(e -> Log.w(TAG, "ML Kit error: " + e.getMessage()))
            .addOnCompleteListener(task -> imageProxy.close());
    }

    // ── ML Kit results ────────────────────────────────────────────────────────

    private void handleMLKitResults(List<DetectedObject> mlResults) {
        JSONArray detectionsJson = new JSONArray();

        for (DetectedObject obj : mlResults) {
            String label      = "object";
            float  confidence = 0f;

            if (obj.getLabels() != null && !obj.getLabels().isEmpty()) {
                DetectedObject.Label top = obj.getLabels().get(0);
                label      = top.getText().toLowerCase();
                confidence = top.getConfidence();
            }

            if (confidence < 0.45f) continue;

            RegisteredObject matched   = findMatch(label);
            boolean          isUnusual = false;

            if (matched != null) {
                isUnusual = isUnusualLocation(matched);
                handleAlert(matched, isUnusual, confidence);
            }

            try {
                Rect   bbox = obj.getBoundingBox();
                JSONObject d = new JSONObject();
                d.put("label",      label);
                d.put("confidence", confidence);
                d.put("isRegistered", matched != null);
                d.put("isUnusual",    isUnusual);
                d.put("displayName",  matched != null ? matched.objectName : label);
                d.put("usualLocation", matched != null ? matched.usualLocation : "");
                d.put("bbox_x",  bbox.left);
                d.put("bbox_y",  bbox.top);
                d.put("bbox_w",  bbox.width());
                d.put("bbox_h",  bbox.height());
                d.put("source",  "mlkit");
                detectionsJson.put(d);
            } catch (Exception ignored) {}
        }

        broadcastDetections(detectionsJson);
    }

    // ── Alert handling ────────────────────────────────────────────────────────

    private final java.util.Map<String, Long> lastAlertTime = new java.util.HashMap<>();
    private static final long ALERT_COOLDOWN_MS = 30_000;

    private void handleAlert(RegisteredObject obj, boolean isUnusual, float confidence) {
        String key = obj.id + (isUnusual ? "_unusual" : "_found");
        long   now = System.currentTimeMillis();
        Long   last = lastAlertTime.get(key);
        if (last != null && now - last < ALERT_COOLDOWN_MS) return;
        lastAlertTime.put(key, now);

        String title, body;
        if (isUnusual) {
            title = "⚠ " + obj.objectName + " in wrong place!";
            body  = "Should be at: " + obj.usualLocation + ". Currently in: " + currentRoom;
        } else {
            title = "✓ Found: " + obj.objectName;
            body  = "Located in " + currentRoom + " (" + Math.round(confidence * 100) + "% confident)";
        }

        fireNotification(title, body, isUnusual);
        broadcastAlert(obj.objectName, title, body);
    }

    // ── Broadcast to Capacitor plugin ─────────────────────────────────────────

    void broadcastDetections(JSONArray detections) {
        Intent i = new Intent(ACTION_DETECTION_RESULT);
        i.putExtra(EXTRA_DETECTIONS, detections.toString());
        sendBroadcast(i);
    }

    void broadcastAlert(String objectName, String title, String body) {
        Intent i = new Intent(ACTION_ALERT);
        i.putExtra(EXTRA_ALERT_OBJECT, objectName);
        i.putExtra(EXTRA_ALERT_MSG,    title + ": " + body);
        sendBroadcast(i);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private RegisteredObject findMatch(String label) {
        String l = label.toLowerCase().trim();
        for (RegisteredObject obj : registeredObjects) {
            String n = obj.objectName.toLowerCase().trim();
            if (n.equals(l) || n.contains(l) || l.contains(n)) return obj;
        }
        return null;
    }

    private boolean isUnusualLocation(RegisteredObject obj) {
        if (obj.usualLocation == null || obj.usualLocation.isEmpty()) return false;
        return !currentRoom.toLowerCase().contains(obj.usualLocation.toLowerCase().trim());
    }

    // ── Notifications ─────────────────────────────────────────────────────────

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Foreground (silent, persistent)
            NotificationChannel fg = new NotificationChannel(
                CHANNEL_ID, "Pulse Object Detection", NotificationManager.IMPORTANCE_LOW);
            fg.setDescription("Runs while object detection is active");
            notifManager.createNotificationChannel(fg);

            // Alerts (high priority, heads-up)
            NotificationChannel alert = new NotificationChannel(
                CHANNEL_ALERT_ID, "Pulse Object Alerts", NotificationManager.IMPORTANCE_HIGH);
            alert.setDescription("Notifies when objects are found or misplaced");
            alert.enableVibration(true);
            notifManager.createNotificationChannel(alert);
        }
    }

    private Notification buildForegroundNotification(String text) {
        Intent tapIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Pulse Object Monitor")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentIntent(pi)
            .setOngoing(true)
            .setSilent(true)
            .build();
    }

    private int alertNotifId = 2000;
    private void fireNotification(String title, String body, boolean isUrgent) {
        Intent tapIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new NotificationCompat.Builder(this, CHANNEL_ALERT_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(isUrgent ? android.R.drawable.ic_dialog_alert : android.R.drawable.ic_dialog_info)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setPriority(isUrgent ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT)
            .build();

        notifManager.notify(alertNotifId++, n);
    }

    // ── Public API (called by plugin) ─────────────────────────────────────────

    public void setRegisteredObjects(List<RegisteredObject> objects) {
        this.registeredObjects = objects;
    }

    public void setCurrentRoom(String room) {
        this.currentRoom = room;
    }

    public boolean isRunning() { return isRunning; }

    // ── Inner model ───────────────────────────────────────────────────────────

    public static class RegisteredObject {
        public String id;
        public String objectName;
        public String usualLocation;
        public RegisteredObject(String id, String name, String usualLoc) {
            this.id = id; this.objectName = name; this.usualLocation = usualLoc;
        }
    }
}