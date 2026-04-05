import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Camera, ScanSearch, ArrowLeft, Loader2, Zap, Eye, RefreshCw, Save, AlertTriangle, CheckCircle2, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import AnimatedSection from '@/components/AnimatedSection';
import Logo from '@/components/Logo';
import { showNotification } from '@/components/NotificationSystem';

interface DetectedObject {
  name: string;
  confidence: number;
  size: "tiny" | "small" | "medium" | "large";
  location: string;
  isRegistered?: boolean;
  isUnusual?: boolean;
  usualLocation?: string;
}

interface RegisteredObject {
  id: string;
  object_name: string;
  usual_location: string;
  secondary_location: string;
  last_known_location: string;
  is_wearable: boolean;
}

interface Room {
  id: string;
  room_name: string;
  floor: string;
}

const ALERT_COOLDOWN = 30_000;

const sizeColors: Record<string, string> = {
  tiny: "bg-accent/20 text-accent border-accent/30",
  small: "bg-primary/20 text-primary border-primary/30",
  medium: "bg-success/20 text-success border-success/30",
  large: "bg-warning/20 text-warning border-warning/30",
};

const CameraDetection = () => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [autoDetect, setAutoDetect] = useState(false);
  const autoDetectRef = useRef(false);
  const lastAlertRef = useRef<Record<string, number>>({});

  const [registeredObjects, setRegisteredObjects] = useState<RegisteredObject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [unusualAlerts, setUnusualAlerts] = useState<string[]>([]);

  // Load registered objects — now includes secondary_location + is_wearable
  useEffect(() => {
    if (!user) return;
    supabase.from('objects')
      .select('id, object_name, usual_location, secondary_location, last_known_location, is_wearable')
      .eq('user_id', user.id)
      .then(({ data }) => { if (data) setRegisteredObjects(data as RegisteredObject[]); });
  }, [user]);

  // Load rooms
  useEffect(() => {
    if (!user) return;
    supabase.from('rooms')
      .select('id, room_name, floor')
      .eq('user_id', user.id)
      .then(({ data }) => { if (data) setRooms(data as Room[]); });
  }, [user]);

  const findRegisteredMatch = useCallback((detectedName: string): RegisteredObject | undefined => {
    const nl = detectedName.toLowerCase().trim();
    return registeredObjects.find(obj => {
      const ol = obj.object_name.toLowerCase().trim();
      return ol === nl || ol.includes(nl) || nl.includes(ol);
    });
  }, [registeredObjects]);

  // ── Core fix: wearable skips alert; secondary_location is also checked ──
  const checkIsUnusual = useCallback((
    registered: RegisteredObject,
    currentLocation: string,
  ): boolean => {
    // Wearables (watch, ring, etc.) are always with the person — never unusual
    if (registered.is_wearable) return false;

    const loc = currentLocation.toLowerCase();
    const usual = (registered.usual_location || '').toLowerCase().trim();
    const secondary = (registered.secondary_location || '').toLowerCase().trim();

    // Not unusual if current room matches usual OR secondary location
    const matchesUsual = usual ? loc.includes(usual) : true;
    const matchesSecondary = secondary ? loc.includes(secondary) : false;

    return !matchesUsual && !matchesSecondary;
  }, []);

  const logDetection = useCallback(async (
    obj: DetectedObject,
    registeredObj: RegisteredObject,
    currentLocation: string,
  ) => {
    if (!user) return;
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      object_id: registeredObj.id,
      activity_type: obj.isUnusual ? 'unusual_activity' : 'detected',
      location: currentLocation,
      confidence: obj.confidence / 100,
      metadata: {
        object_name: obj.name,
        usual_location: registeredObj.usual_location,
        is_unusual: obj.isUnusual,
        detected_at: obj.location,
      },
    });
    await supabase.from('objects')
      .update({
        last_known_location: currentLocation,
        last_detected_time: new Date().toISOString(),
      })
      .eq('id', registeredObj.id);
  }, [user]);

  const checkAlerts = useCallback((detected: DetectedObject[], currentLocation: string) => {
    for (const obj of detected) {
      if (!obj.isRegistered || !obj.isUnusual) continue;
      const key = obj.name;
      const now = Date.now();
      if (now - (lastAlertRef.current[key] ?? 0) < ALERT_COOLDOWN) continue;
      lastAlertRef.current[key] = now;

      showNotification(
        '⚠ Unusual Activity Detected',
        `"${obj.name}" found in ${currentLocation}. Should be: ${obj.usualLocation}`,
        'warning',
        true,
      );
      toast.error(`⚠ ${obj.name} found in wrong location! Should be: ${obj.usualLocation}`);
      setUnusualAlerts(prev => [
        `${obj.name} — found in ${currentLocation} (usual: ${obj.usualLocation})`,
        ...prev,
      ].slice(0, 10));

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(
          `Alert! ${obj.name} found in unusual location. It should be at ${obj.usualLocation}.`
        );
        window.speechSynthesis.speak(u);
      }
    }
  }, []);

  const saveObjects = useCallback(async () => {
    if (!user || objects.length === 0) return;
    setSaving(true);
    try {
      const rows = objects.map((obj) => ({
        user_id: user.id,
        name: obj.name,
        confidence: obj.confidence,
        size: obj.size,
        location: obj.location,
        status: "safe",
      }));
      const { error } = await supabase.from("detected_objects").insert(rows);
      if (error) throw error;
      toast.success(`Saved ${objects.length} object(s) to your tracked items!`);
    } catch (e: any) {
      toast.error(e.message || "Failed to save objects");
    } finally {
      setSaving(false);
    }
  }, [user, objects]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
        setCapturedImage(null);
        setObjects([]);
      }
    } catch {
      toast.error("Could not access camera. Please allow camera permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
    setAutoDetect(false);
    autoDetectRef.current = false;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    const maxWidth = 640;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.5);
  }, []);

  const detectObjects = useCallback(async (imageData?: string) => {
    const image = imageData || captureFrame();
    if (!image) return;
    setCapturedImage(image);
    setDetecting(true);

    try {
      const { data, error } = await supabase.functions.invoke("detect-objects", {
        body: { image },
      });
      if (error) throw error;

      const currentLocation = selectedRoom
        ? `${selectedRoom.room_name} (${selectedRoom.floor})`
        : 'Unknown Location';

      const detected: DetectedObject[] = (data?.objects || []).map((obj: DetectedObject) => {
        const registered = findRegisteredMatch(obj.name);
        if (!registered) return { ...obj, isRegistered: false };

        const isUnusual = checkIsUnusual(registered, currentLocation);

        return {
          ...obj,
          isRegistered: true,
          isUnusual,
          usualLocation: registered.usual_location,
        };
      });

      setObjects(detected);
      checkAlerts(detected, currentLocation);

      for (const obj of detected) {
        if (obj.isRegistered) {
          const registered = findRegisteredMatch(obj.name);
          if (registered) logDetection(obj, registered, currentLocation);
        }
      }

      if (detected.length > 0) {
        toast.success(`Detected ${detected.length} object${detected.length > 1 ? "s" : ""}!`);
      } else {
        toast.info("No objects detected. Try a different angle.");
      }
    } catch (e: any) {
      toast.error(e.message || "Detection failed");
    } finally {
      setDetecting(false);
    }
  }, [captureFrame, findRegisteredMatch, checkIsUnusual, checkAlerts, logDetection, selectedRoom]);

  useEffect(() => {
    autoDetectRef.current = autoDetect;
    if (!autoDetect || !streaming) return;
    let timeout: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (!autoDetectRef.current) return;
      detectObjects();
      timeout = setTimeout(loop, 5000);
    };
    loop();
    return () => clearTimeout(timeout);
  }, [autoDetect, streaming, detectObjects]);

  const unusualObjects = objects.filter(o => o.isRegistered && o.isUnusual);
  const normalObjects = objects.filter(o => o.isRegistered && !o.isUnusual);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Link>
            <Logo size={24} />
          </div>
          <h1 className="font-heading font-bold text-sm flex items-center gap-2">
            <ScanSearch className="w-4 h-4 text-primary" /> Object Detection
          </h1>
        </div>
      </header>

      <main className="container py-6 space-y-6 max-w-4xl">

        {/* Room Selector */}
        <AnimatedSection>
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Which room is this camera in?</h3>
            </div>
            {rooms.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No rooms added yet. Add rooms to enable location-based alerts.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoom(r => r?.id === room.id ? null : room)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                      selectedRoom?.id === room.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-foreground border-border hover:border-primary/30'
                    }`}
                  >
                    {room.room_name} · {room.floor}
                  </button>
                ))}
              </div>
            )}
            {selectedRoom && (
              <p className="text-xs text-primary mt-2">
                📍 Camera set to: <strong>{selectedRoom.room_name}</strong> — {selectedRoom.floor}
              </p>
            )}
            {!selectedRoom && rooms.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                ⚠ Select a room to enable location-based alerts
              </p>
            )}
          </div>
        </AnimatedSection>

        {/* Camera Feed */}
        <AnimatedSection>
          <div className="glass rounded-2xl overflow-hidden">
            <div className="relative aspect-video bg-secondary/50 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${streaming ? "block" : "hidden"}`}
              />
              {capturedImage && !streaming && (
                <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
              )}
              {!streaming && !capturedImage && (
                <div className="text-center space-y-4 p-8">
                  <Camera className="w-16 h-16 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground">Start your camera to detect objects</p>
                </div>
              )}
              {detecting && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                  <div className="flex items-center gap-3 glass px-6 py-3 rounded-full">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm font-medium">Analyzing...</span>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Controls */}
            <div className="p-4 flex flex-wrap items-center justify-center gap-3">
              {!streaming ? (
                <button
                  onClick={startCamera}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-all"
                >
                  <Camera className="w-4 h-4" /> Start Camera
                </button>
              ) : (
                <>
                  <button
                    onClick={() => detectObjects()}
                    disabled={detecting}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    <Eye className="w-4 h-4" /> Detect Now
                  </button>
                  <button
                    onClick={() => setAutoDetect((p) => !p)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      autoDetect
                        ? "bg-accent/20 text-accent border-accent/30"
                        : "bg-secondary text-foreground border-border hover:border-primary/30"
                    }`}
                  >
                    <Zap className="w-4 h-4" /> {autoDetect ? "Auto ON" : "Auto OFF"}
                  </button>
                  <button
                    onClick={stopCamera}
                    className="flex items-center gap-2 bg-destructive/10 text-destructive px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-destructive/20 transition-all"
                  >
                    Stop
                  </button>
                </>
              )}
              {capturedImage && !streaming && (
                <button
                  onClick={startCamera}
                  className="flex items-center gap-2 bg-secondary text-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-secondary/80 transition-all border border-border"
                >
                  <RefreshCw className="w-4 h-4" /> New Scan
                </button>
              )}
              {objects.length > 0 && user && (
                <button
                  onClick={saveObjects}
                  disabled={saving}
                  className="flex items-center gap-2 bg-success/20 text-success px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-success/30 transition-all border border-success/30 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save to Dashboard"}
                </button>
              )}
            </div>
          </div>
        </AnimatedSection>

        {/* Unusual Alerts */}
        {unusualObjects.length > 0 && (
          <AnimatedSection>
            <div className="border-2 border-destructive/50 bg-destructive/10 rounded-2xl p-4">
              <h2 className="font-heading text-base font-semibold flex items-center gap-2 mb-3 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                ⚠ {unusualObjects.length} Object{unusualObjects.length > 1 ? "s" : ""} in Wrong Location!
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {unusualObjects.map((obj, i) => (
                  <div key={i} className="bg-destructive/10 border border-destructive/30 rounded-xl p-3">
                    <p className="font-semibold text-sm capitalize text-destructive">{obj.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">📍 Detected at: {obj.location}</p>
                    {obj.usualLocation && (
                      <p className="text-xs text-destructive mt-1">
                        Should be: <strong>{obj.usualLocation}</strong>
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{obj.confidence}% confidence</p>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        )}

        {/* Normal registered objects */}
        {normalObjects.length > 0 && (
          <AnimatedSection>
            <div className="border border-success/30 bg-success/10 rounded-2xl p-4">
              <h2 className="font-heading text-base font-semibold flex items-center gap-2 mb-3 text-success">
                <CheckCircle2 className="w-5 h-5" />
                Objects in Correct Location ({normalObjects.length})
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {normalObjects.map((obj, i) => (
                  <div key={i} className="bg-success/10 border border-success/20 rounded-xl p-3">
                    <p className="font-semibold text-sm capitalize">{obj.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">📍 {obj.location}</p>
                    {obj.usualLocation && (
                      <p className="text-xs text-success mt-1">✓ {obj.usualLocation}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{obj.confidence}% confidence</p>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        )}

        {/* All Detected Objects */}
        {objects.length > 0 && (
          <AnimatedSection delay={100}>
            <h2 className="font-heading text-lg font-semibold flex items-center gap-2 mb-4">
              <ScanSearch className="w-5 h-5 text-primary" />
              Detected Objects ({objects.length})
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {objects.map((obj, i) => (
                <AnimatedSection key={`${obj.name}-${i}`} delay={150 + i * 60}>
                  <div className={`glass rounded-xl p-4 transition-colors border ${
                    obj.isUnusual
                      ? 'border-destructive/40'
                      : obj.isRegistered
                      ? 'border-success/40'
                      : 'border-border'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-heading font-semibold text-sm capitalize truncate">
                          {obj.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">📍 {obj.location}</p>
                        {obj.isRegistered && !obj.isUnusual && (
                          <p className="text-xs text-success mt-1">✓ Your registered object</p>
                        )}
                        {obj.isUnusual && (
                          <p className="text-xs text-destructive mt-1">⚠ Wrong location!</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${sizeColors[obj.size]}`}>
                          {obj.size}
                        </span>
                        <span className="text-xs text-muted-foreground">{obj.confidence}%</span>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          obj.isUnusual
                            ? 'bg-destructive'
                            : obj.isRegistered
                            ? 'bg-success'
                            : 'bg-primary'
                        }`}
                        style={{ width: `${obj.confidence}%` }}
                      />
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </AnimatedSection>
        )}

        {/* Unusual Activity Log */}
        {unusualAlerts.length > 0 && (
          <AnimatedSection>
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading text-base font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Unusual Activity Log
                </h2>
                <button
                  onClick={() => setUnusualAlerts([])}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-2">
                {unusualAlerts.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{a}
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        )}

      </main>
    </div>
  );
};

export default CameraDetection;