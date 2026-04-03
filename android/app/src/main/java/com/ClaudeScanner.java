package com.pulse.app.detection;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageFormat;
import android.graphics.Rect;
import android.graphics.YuvImage;
import android.util.Base64;
import android.util.Log;

import androidx.camera.core.ImageProxy;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * ClaudeScanner
 *
 * Runs on a background thread. Every SCAN_INTERVAL_MS it:
 * 1. Takes the latest camera frame
 * 2. Compresses it to JPEG base64
 * 3. Sends it to Claude claude-sonnet-4-20250514 with list of non-ML-Kit objects
 * 4. Parses results and broadcasts back via CameraDetectionService
 *
 * ML Kit covers ~80 common objects. Claude handles everything else:
 * keys, rings, wallets, pens, medicines, documents, specific branded items, etc.
 */
public class ClaudeScanner {

    private static final String TAG              = "ClaudeScanner";
    private static final long   SCAN_INTERVAL_MS = 1_000; // 1 second
    private static final int    JPEG_QUALITY     = 60;
    private static final int    MAX_WIDTH        = 512;

    private final CameraDetectionService service;
    private final OkHttpClient           httpClient;
    private final ExecutorService        executor;
    private final AtomicBoolean          scanning    = new AtomicBoolean(false);
    private final AtomicBoolean          stopped     = new AtomicBoolean(false);
    private final AtomicLong             lastScan    = new AtomicLong(0);

    // Latest compressed frame — updated on every camera frame, read by scan thread
    private volatile byte[] latestJpegBytes = null;

    // ML Kit covers these broadly — Claude only handles the rest
    private static final List<String> ML_KIT_CATEGORIES = List.of(
        "person","animal","food","vehicle","home good","fashion good",
        "place","plant","flower","fruit","furniture"
    );

    public ClaudeScanner(CameraDetectionService service) {
        this.service    = service;
        this.httpClient = new OkHttpClient.Builder()
            .connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
            .build();
        this.executor = Executors.newSingleThreadExecutor();
    }

    // ── Called every camera frame ─────────────────────────────────────────────

    public void submitFrame(ImageProxy imageProxy,
                            List<CameraDetectionService.RegisteredObject> objects) {
        if (stopped.get()) return;

        long now = System.currentTimeMillis();
        if (now - lastScan.get() < SCAN_INTERVAL_MS) return;
        if (scanning.get()) return;

        // Filter to objects ML Kit won't reliably find
        List<CameraDetectionService.RegisteredObject> targets = filterForClaude(objects);
        if (targets.isEmpty()) return;

        // Compress frame to JPEG on calling thread (camera executor) before imageProxy closes
        byte[] jpegBytes = compressFrame(imageProxy);
        if (jpegBytes == null) return;

        latestJpegBytes = jpegBytes;

        // Launch Claude scan async
        lastScan.set(now);
        scanning.set(true);
        List<CameraDetectionService.RegisteredObject> targetsCopy = new ArrayList<>(targets);

        executor.execute(() -> {
            try {
                scanWithClaude(latestJpegBytes, targetsCopy);
            } finally {
                scanning.set(false);
            }
        });
    }

    public void stop() {
        stopped.set(true);
        executor.shutdownNow();
    }

    // ── Filter objects to only those outside ML Kit coverage ─────────────────

    private List<CameraDetectionService.RegisteredObject> filterForClaude(
            List<CameraDetectionService.RegisteredObject> objects) {
        List<CameraDetectionService.RegisteredObject> result = new ArrayList<>();
        for (CameraDetectionService.RegisteredObject obj : objects) {
            if (!isCoveredByMLKit(obj.objectName)) result.add(obj);
        }
        return result;
    }

    private boolean isCoveredByMLKit(String name) {
        String n = name.toLowerCase().trim();
        // These broad categories ML Kit handles well
        String[] mlKitWords = {
            "person","human","dog","cat","bird","car","bicycle","motorcycle",
            "bus","truck","chair","sofa","couch","bed","table","desk",
            "tv","laptop","bottle","cup","bowl","fork","knife","spoon",
            "book","plant","vase","clock","phone","keyboard","mouse",
            "backpack","bag","umbrella","shoe"
        };
        for (String w : mlKitWords) {
            if (n.contains(w)) return true;
        }
        return false;
    }

    // ── Compress YUV frame to JPEG ────────────────────────────────────────────

    private byte[] compressFrame(ImageProxy imageProxy) {
        try {
            ImageProxy.PlaneProxy[] planes = imageProxy.getPlanes();
            if (planes.length == 0) return null;

            // YUV_420_888 → NV21 → JPEG
            ByteBuffer yBuffer  = planes[0].getBuffer();
            ByteBuffer uBuffer  = planes[1].getBuffer();
            ByteBuffer vBuffer  = planes[2].getBuffer();

            int ySize = yBuffer.remaining();
            int uSize = uBuffer.remaining();
            int vSize = vBuffer.remaining();

            byte[] nv21 = new byte[ySize + uSize + vSize];
            yBuffer.get(nv21, 0, ySize);
            vBuffer.get(nv21, ySize, vSize);
            uBuffer.get(nv21, ySize + vSize, uSize);

            int w = imageProxy.getWidth();
            int h = imageProxy.getHeight();

            YuvImage yuvImage = new YuvImage(nv21, ImageFormat.NV21, w, h, null);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            yuvImage.compressToJpeg(new Rect(0, 0, w, h), JPEG_QUALITY, out);
            byte[] jpegFull = out.toByteArray();

            // Scale down if needed
            Bitmap bmp = BitmapFactory.decodeByteArray(jpegFull, 0, jpegFull.length);
            if (bmp == null) return null;

            if (bmp.getWidth() > MAX_WIDTH) {
                float scale = (float) MAX_WIDTH / bmp.getWidth();
                int   newH  = Math.round(bmp.getHeight() * scale);
                bmp = Bitmap.createScaledBitmap(bmp, MAX_WIDTH, newH, true);
            }

            ByteArrayOutputStream finalOut = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, finalOut);
            return finalOut.toByteArray();

        } catch (Exception e) {
            Log.w(TAG, "Frame compress failed: " + e.getMessage());
            return null;
        }
    }

    // ── Claude API call ───────────────────────────────────────────────────────

    private void scanWithClaude(byte[] jpegBytes,
                                List<CameraDetectionService.RegisteredObject> targets) {
        if (jpegBytes == null || targets.isEmpty()) return;

        String base64Image = Base64.encodeToString(jpegBytes, Base64.NO_WRAP);

        StringBuilder list = new StringBuilder();
        for (int i = 0; i < targets.size(); i++) {
            list.append(i + 1).append(". \"").append(targets.get(i).objectName).append("\"\n");
        }

        String prompt = "You are a strict object detection system. Examine this camera frame carefully.\n\n"
            + "Find these specific objects:\n" + list
            + "\nRespond ONLY with a raw JSON array — no markdown, no explanation:\n"
            + "[\n"
            + "  {\"index\":1,\"found\":true,\"confidence\":\"high\",\"location_hint\":\"bottom-center\"},\n"
            + "  {\"index\":2,\"found\":false,\"confidence\":\"high\",\"location_hint\":\"\"}\n"
            + "]\n\n"
            + "Rules:\n"
            + "- confidence: \"high\" = clearly visible, \"medium\" = partially visible, \"low\" = uncertain\n"
            + "- Only set found=true if confidence is \"high\" or \"medium\"\n"
            + "- location_hint must be one of: top-left, top-center, top-right, center-left, center, "
            + "center-right, bottom-left, bottom-center, bottom-right";

        try {
            JSONObject imageSource = new JSONObject()
                .put("type", "base64")
                .put("media_type", "image/jpeg")
                .put("data", base64Image);

            JSONObject imageContent = new JSONObject()
                .put("type", "image")
                .put("source", imageSource);

            JSONObject textContent = new JSONObject()
                .put("type", "text")
                .put("text", prompt);

            JSONArray contentArray = new JSONArray()
                .put(imageContent)
                .put(textContent);

            JSONObject message = new JSONObject()
                .put("role", "user")
                .put("content", contentArray);

            JSONObject body = new JSONObject()
                .put("model", "claude-sonnet-4-20250514")
                .put("max_tokens", 600)
                .put("messages", new JSONArray().put(message));

            Request request = new Request.Builder()
                .url("https://api.anthropic.com/v1/messages")
                .post(RequestBody.create(body.toString(),
                    MediaType.parse("application/json")))
                .addHeader("Content-Type", "application/json")
                // API key is injected via BuildConfig — set ANTHROPIC_API_KEY in local.properties
                .addHeader("x-api-key", com.pulse.app.BuildConfig.ANTHROPIC_API_KEY)
                .addHeader("anthropic-version", "2023-06-01")
                .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful() || response.body() == null) return;
                String responseBody = response.body().string();
                parseAndBroadcast(responseBody, targets);
            }

        } catch (Exception e) {
            Log.w(TAG, "Claude API error: " + e.getMessage());
        }
    }

    // ── Parse Claude response ─────────────────────────────────────────────────

    private void parseAndBroadcast(String responseBody,
                                   List<CameraDetectionService.RegisteredObject> targets) {
        try {
            JSONObject resp    = new JSONObject(responseBody);
            JSONArray  content = resp.getJSONArray("content");
            String     text    = "";

            for (int i = 0; i < content.length(); i++) {
                JSONObject c = content.getJSONObject(i);
                if ("text".equals(c.getString("type"))) {
                    text = c.getString("text").trim();
                    break;
                }
            }

            // Strip markdown fences if any
            text = text.replaceAll("```json|```", "").trim();
            if (text.isEmpty()) return;

            JSONArray  results        = new JSONArray(text);
            JSONArray  detectionsJson = new JSONArray();

            for (int i = 0; i < results.length(); i++) {
                JSONObject r          = results.getJSONObject(i);
                int        index      = r.getInt("index") - 1;
                boolean    found      = r.getBoolean("found");
                String     confidence = r.optString("confidence", "low");
                String     hint       = r.optString("location_hint", "center");

                if (!found) continue;
                if ("low".equals(confidence)) continue;
                if (index < 0 || index >= targets.size()) continue;

                CameraDetectionService.RegisteredObject obj = targets.get(index);
                boolean isUnusual = isUnusualLocation(obj);
                float   score     = "high".equals(confidence) ? 0.93f : 0.76f;

                service.handleAlert(obj, isUnusual, score); // package-private

                JSONObject d = new JSONObject();
                d.put("label",        obj.objectName);
                d.put("confidence",   score);
                d.put("isRegistered", true);
                d.put("isUnusual",    isUnusual);
                d.put("displayName",  obj.objectName);
                d.put("usualLocation", obj.usualLocation != null ? obj.usualLocation : "");
                d.put("locationHint", hint);
                d.put("source",       "claude");
                detectionsJson.put(d);
            }

            if (detectionsJson.length() > 0) {
                service.broadcastDetections(detectionsJson);
            }

        } catch (Exception e) {
            Log.w(TAG, "Claude parse error: " + e.getMessage());
        }
    }

    private boolean isUnusualLocation(CameraDetectionService.RegisteredObject obj) {
        if (obj.usualLocation == null || obj.usualLocation.isEmpty()) return false;
        // Access currentRoom via service (package-private field)
        return !service.currentRoom.toLowerCase()
            .contains(obj.usualLocation.toLowerCase().trim());
    }
}