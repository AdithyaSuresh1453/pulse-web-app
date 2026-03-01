import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera, CameraOff, Volume2, VolumeX, AlertTriangle,
  CheckCircle2, Eye, MapPin, Clock, Loader2, Sun, Bug,
} from 'lucide-react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { showNotification } from '../../components/NotificationSystem';

// ─── Constants ────────────────────────────────────────────────────────────────
const MIN_CONFIDENCE    = 0.40; // lowered so more detections appear
const STABILITY_FRAMES  = 3;   // fewer frames needed before showing box

// Per-class higher bar only for the most notorious false-positives
const CLASS_MIN_CONFIDENCE: Record<string, number> = {
  'toilet': 0.88,
};

// Maps COCO class names → keywords users might register objects as
const CLASS_ALIASES: Record<string, string[]> = {
  'cell phone':   ['phone','mobile','smartphone','iphone','android','samsung','pixel','cellphone'],
  'remote':       ['remote','tv remote','remote control','airpods','airpod','earbuds','earbud','earphones','earphone','headphones','wireless earbuds'],
  'book':         ['book','notebook','diary','journal','textbook'],
  'backpack':     ['backpack','bag','school bag','rucksack'],
  'handbag':      ['handbag','purse','bag','clutch','tote','wallet'],
  'suitcase':     ['suitcase','luggage','travel bag'],
  'bottle':       ['bottle','water bottle','flask'],
  'cup':          ['cup','mug','glass','tumbler'],
  'laptop':       ['laptop','computer','macbook'],
  'keyboard':     ['keyboard'],
  'mouse':        ['mouse','computer mouse'],
  'scissors':     ['scissors'],
  'umbrella':     ['umbrella'],
  'tie':          ['tie','necktie'],
  'clock':        ['clock','watch','alarm'],
  'vase':         ['vase'],
  'person':       ['person','human'],
  'chair':        ['chair'],
  'couch':        ['couch','sofa','settee'],
  'tv':           ['tv','television','monitor','screen'],
  'toothbrush':   ['toothbrush'],
  'hair drier':   ['hair drier','hairdryer','hair dryer'],
  'teddy bear':   ['teddy','teddy bear','stuffed toy','plush'],
  'potted plant': ['plant','potted plant','flower','succulent'],
  'knife':        ['knife'],
  'fork':         ['fork'],
  'spoon':        ['spoon'],
  'bowl':         ['bowl'],
  'bed':          ['bed'],
  'refrigerator': ['fridge','refrigerator'],
  'sink':         ['sink'],
  'oven':         ['oven'],
  'microwave':    ['microwave'],
  'dining table': ['table','desk','dining table'],
  'bicycle':      ['bicycle','bike','cycle'],
  'cat':          ['cat','kitten'],
  'dog':          ['dog','puppy'],
  'donut':        ['donut','doughnut','pastry'],
  'cake':         ['cake'],
  'pizza':        ['pizza'],
  'banana':       ['banana'],
  'apple':        ['apple'],
  'sandwich':     ['sandwich'],
  'wine glass':   ['wine glass','glass','goblet'],
  'sports ball':  ['ball','football','basketball','soccer ball'],
  'skateboard':   ['skateboard'],
  'car':          ['car','vehicle'],
};

interface RegisteredObject {
  id: string;
  object_name: string;
  usual_location: string;
  last_known_location: string;
  image_url?: string;
}

interface Detection {
  cocoClass: string;
  displayName: string;
  score: number;
  bbox: [number, number, number, number];
  isRegistered: boolean;
  isUnusual: boolean;
  usualLocation?: string;
}

function findMatch(cocoClass: string, objects: RegisteredObject[]): RegisteredObject | undefined {
  const cl = cocoClass.toLowerCase().trim();
  return objects.find(obj => {
    const nl = obj.object_name.toLowerCase().trim();
    if (nl.includes(cl) || cl.includes(nl)) return true;
    return (CLASS_ALIASES[cl] ?? []).some(a => nl.includes(a) || a.includes(nl));
  });
}

function getCurrentLocationLabel(): string {
  const h = new Date().getHours();
  if (h >= 6  && h < 12) return 'Living Area (Morning)';
  if (h >= 12 && h < 17) return 'Living Area (Afternoon)';
  if (h >= 17 && h < 21) return 'Living Area (Evening)';
  return 'Living Area (Night)';
}

// ─── Draw a box with corner brackets + label ─────────────────────────────────
function drawDetectionBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string,
  label: string,
  subLabel: string,
) {
  // Outline only — no fill
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur  = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth   = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();

  // Corner brackets
  const bs = Math.min(18, w * 0.15, h * 0.15);
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 8;
  ctx.beginPath();
  // top-left
  ctx.moveTo(x, y + bs);     ctx.lineTo(x, y);         ctx.lineTo(x + bs, y);
  // top-right
  ctx.moveTo(x+w-bs, y);     ctx.lineTo(x+w, y);       ctx.lineTo(x+w, y+bs);
  // bottom-left
  ctx.moveTo(x, y+h-bs);     ctx.lineTo(x, y+h);       ctx.lineTo(x+bs, y+h);
  // bottom-right
  ctx.moveTo(x+w-bs, y+h);   ctx.lineTo(x+w, y+h);     ctx.lineTo(x+w, y+h-bs);
  ctx.stroke();
  ctx.restore();

  // Label background pill
  ctx.save();
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textBaseline = 'top';
  const pad  = 6;
  const lh   = 19;
  const lw   = ctx.measureText(label).width + pad * 2;
  const slw  = ctx.measureText(subLabel).width + pad * 2;
  const boxW = Math.max(lw, slw);
  const boxH = lh * 2 + pad * 2;
  const ly   = y >= boxH + 4 ? y - boxH - 4 : y + h + 2;

  // Background
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur  = 6;
  ctx.fillStyle   = color;
  ctx.beginPath();
  ctx.roundRect(x, ly, boxW, boxH, 5);
  ctx.fill();
  ctx.restore();

  // Label text
  ctx.save();
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, x + pad, ly + pad);
  ctx.font = '11px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(subLabel, x + pad, ly + pad + lh);
  ctx.restore();
}

export function LiveCamera() {
  const { user } = useAuth();
  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const modelRef      = useRef<cocoSsd.ObjectDetection | null>(null);
  const rafRef        = useRef<number>(0);
  const isRunning     = useRef(false);
  const lastAlertRef  = useRef<Record<string, number>>({});
  const frameCountRef = useRef<Record<string, number>>({});

  const [modelLoaded,   setModelLoaded]   = useState(false);
  const [modelError,    setModelError]    = useState('');
  const [isActive,      setIsActive]      = useState(false);
  const [cameraError,   setCameraError]   = useState('');
  const [voiceEnabled,  setVoiceEnabled]  = useState(true);
  const [nightMode,     setNightMode]     = useState(false);
  const [brightness,    setBrightness]    = useState(100);
  const [debugMode,     setDebugMode]     = useState(false); // shows ALL detections
  const [detections,    setDetections]    = useState<Detection[]>([]);
  const [unusualAlerts, setUnusualAlerts] = useState<string[]>([]);
  const [registeredObjects, setRegisteredObjects] = useState<RegisteredObject[]>([]);

  // ── Load model ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await cocoSsd.load({ base: 'mobilenet_v2' });
        if (!cancelled) { modelRef.current = m; setModelLoaded(true); }
      } catch {
        if (!cancelled) setModelError('Failed to load AI model. Please refresh.');
      }
    })();
    return () => { cancelled = true; stopCamera(); };
  }, []);

  // ── Load registered objects ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from('objects')
      .select('id, object_name, usual_location, last_known_location, image_url')
      .eq('user_id', user.id)
      .then(({ data }) => { if (data) setRegisteredObjects(data as RegisteredObject[]); });
  }, [user]);

  // ── Voice ─────────────────────────────────────────────────────────────────
  const lastSpoken = useRef('');
  const speak = useCallback((text: string) => {
    if (!voiceEnabled || text === lastSpoken.current) return;
    lastSpoken.current = text;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    }
  }, [voiceEnabled]);

  // ── Supabase log (throttled 30 s) ─────────────────────────────────────────
  const logDetection = useCallback(async (
    obj: RegisteredObject, confidence: number, isUnusual: boolean, loc: string,
  ) => {
    if (!user) return;
    const now = Date.now();
    if (now - (lastAlertRef.current[obj.id] ?? 0) < 30_000) return;
    lastAlertRef.current[obj.id] = now;
    await supabase.from('activity_logs').insert({
      user_id: user.id, object_id: obj.id,
      activity_type: isUnusual ? 'unusual_activity' : 'detected',
      location: loc, confidence,
      metadata: { usual_location: obj.usual_location, is_unusual: isUnusual },
    });
    await supabase.from('objects')
      .update({ last_known_location: loc, last_detected_time: new Date().toISOString() })
      .eq('id', obj.id);
  }, [user]);

  // ── Detection loop ────────────────────────────────────────────────────────
  const debugModeRef = useRef(debugMode);
  useEffect(() => { debugModeRef.current = debugMode; }, [debugMode]);

  const runDetection = useCallback(async () => {
    if (!isRunning.current) return;

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const model  = modelRef.current;

    if (!video || !canvas || !model || video.readyState < 2) {
      if (isRunning.current) rafRef.current = requestAnimationFrame(runDetection);
      return;
    }

    const vw = video.videoWidth  || 640;
    const vh = video.videoHeight || 480;
    if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; }

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, vw, vh);

    let preds: cocoSsd.DetectedObject[] = [];
    try { preds = await model.detect(video); }
    catch { if (isRunning.current) rafRef.current = requestAnimationFrame(runDetection); return; }

    const currentLocation = getCurrentLocationLabel();
    const newDetections: Detection[] = [];
    const seenClasses = new Set<string>();

    for (const pred of preds) {
      // Basic confidence filter
      if (pred.score < MIN_CONFIDENCE) continue;
      if (pred.score < (CLASS_MIN_CONFIDENCE[pred.class] ?? 0)) continue;

      const [bx, by, bw, bh] = pred.bbox;

      // Temporal stability
      seenClasses.add(pred.class);
      frameCountRef.current[pred.class] = (frameCountRef.current[pred.class] ?? 0) + 1;
      if (frameCountRef.current[pred.class] < STABILITY_FRAMES) continue;

      const matched      = findMatch(pred.class, registeredObjects);
      const isRegistered = !!matched;
      let   isUnusual    = false;
      const displayName  = matched?.object_name ?? pred.class;

      if (matched) {
        const usual = (matched.usual_location || '').toLowerCase().trim();
        if (usual && !currentLocation.toLowerCase().includes(usual)) isUnusual = true;

        const alertKey = matched.id + '_alert';
        const now = Date.now();
        if (isUnusual && now - (lastAlertRef.current[alertKey] ?? 0) > 30_000) {
          lastAlertRef.current[alertKey] = now;
          showNotification(
            'Unusual Activity Detected',
            `"${matched.object_name}" found in unexpected location! Usually at: ${matched.usual_location}`,
            'warning', true,
          );
          speak(`Alert! ${matched.object_name} found in unusual location. It should be at ${matched.usual_location}.`);
          setUnusualAlerts(prev =>
            [`${matched.object_name} — found here (usual: ${matched.usual_location})`, ...prev].slice(0, 10)
          );
        }
        logDetection(matched, pred.score, isUnusual, currentLocation);
      }

      // ── Draw boxes ───────────────────────────────────────────────────────
      const conf = Math.round(pred.score * 100);

      if (isRegistered) {
        const color    = isUnusual ? '#EF4444' : '#10B981';
        const label    = `${displayName.toUpperCase()}  ${conf}%`;
        const subLabel = isUnusual ? `⚠ Should be: ${matched!.usual_location}` : '✓ Normal location';
        drawDetectionBox(ctx, bx, by, bw, bh, color, label, subLabel);
      } else if (debugModeRef.current) {
        drawDetectionBox(ctx, bx, by, bw, bh, '#3B82F6', `${pred.class}  ${conf}%`, 'Not registered');
      }

      newDetections.push({
        cocoClass: pred.class, displayName, score: pred.score,
        bbox: pred.bbox, isRegistered, isUnusual,
        usualLocation: matched?.usual_location,
      });
    }

    // Reset counters for gone classes
    for (const cls of Object.keys(frameCountRef.current)) {
      if (!seenClasses.has(cls)) frameCountRef.current[cls] = 0;
    }

    setDetections(newDetections);
    if (isRunning.current) rafRef.current = requestAnimationFrame(runDetection);
  }, [registeredObjects, speak, logDetection]);

  // ── Camera controls ───────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = ms;
      if (videoRef.current) { videoRef.current.srcObject = ms; await videoRef.current.play(); }
      isRunning.current = true;
      setIsActive(true);
      speak('Camera started.');
      rafRef.current = requestAnimationFrame(runDetection);
    } catch (err) {
      setCameraError(err instanceof Error && err.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access in your browser.'
        : 'Could not access camera. Make sure no other app is using it.');
    }
  }, [runDetection, speak]);

  const stopCamera = useCallback(() => {
    isRunning.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    canvasRef.current?.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    frameCountRef.current = {};
    setIsActive(false);
    setDetections([]);
  }, []);

  useEffect(() => {
    if (isActive) { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(runDetection); }
  }, [registeredObjects, runDetection, isActive]);

  const registeredDetections = detections.filter(d => d.isRegistered);
  const unusual = registeredDetections.filter(d => d.isUnusual);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Live Camera Detection</h1>
        <p className="text-gray-600 dark:text-gray-400">
          🟢 Green box = your object, normal location &nbsp;|&nbsp; 🔴 Red box = your object, wrong location
        </p>
      </div>

      {/* Banners */}
      {!modelLoaded && !modelError && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">Loading AI detection model…</p>
        </div>
      )}
      {modelError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{modelError}</p>
        </div>
      )}
      {cameraError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{cameraError}</p>
        </div>
      )}
      {modelLoaded && registeredObjects.length === 0 && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            No registered objects. <a href="/dashboard/add-object" className="underline font-medium">Add objects</a> to start detecting them.
          </p>
        </div>
      )}

      {/* Debug mode tip */}
      {debugMode && isActive && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
          <Bug className="w-4 h-4 text-blue-500 shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Debug mode ON — blue boxes show everything COCO detects. If your object shows as blue, its name doesn't match a registered object name. Try renaming your registered object to match what COCO calls it.
          </p>
        </div>
      )}

      {/* Stats */}
      {isActive && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Your Objects',  value: registeredDetections.length, icon: Eye,           c: 'blue'  },
            { label: 'Normal',        value: registeredDetections.filter(d=>!d.isUnusual).length, icon: CheckCircle2,  c: 'green' },
            { label: 'Unusual Alert', value: unusual.length,              icon: AlertTriangle, c: 'red'   },
          ].map(({ label, value, icon: Icon, c }) => (
            <div key={label} className={`bg-${c}-50 dark:bg-${c}-900/20 border border-${c}-200 dark:border-${c}-800 rounded-2xl p-3 flex items-center gap-3`}>
              <Icon className={`w-5 h-5 text-${c}-500 shrink-0`} />
              <div>
                <p className={`text-xl font-bold text-${c}-700 dark:text-${c}-400`}>{value}</p>
                <p className={`text-xs text-${c}-600 dark:text-${c}-500`}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Camera card */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={isActive ? stopCamera : startCamera}
              disabled={!modelLoaded}
              className={`px-5 py-2.5 rounded-2xl font-medium flex items-center gap-2 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30'
                  : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-green-500/30'
              }`}
            >
              {isActive ? <><CameraOff className="w-5 h-5" />Stop</> : <><Camera className="w-5 h-5" />Start Camera</>}
            </button>

            <button
              onClick={() => setDebugMode(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                debugMode ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
              }`}
              title="Debug mode shows ALL objects COCO detects, even unregistered ones"
            >
              <Bug className="w-4 h-4" />Debug {debugMode ? 'ON' : 'OFF'}
            </button>

            <button onClick={() => setNightMode(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors ${nightMode ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
              <Sun className="w-4 h-4" />Night {nightMode ? 'ON' : 'OFF'}
            </button>

            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-gray-400" />
              <input type="range" min={60} max={250} value={brightness}
                onChange={e => setBrightness(Number(e.target.value))}
                className="w-20 accent-yellow-400" />
              <span className="text-xs text-gray-500 w-8">{brightness}%</span>
            </div>

            <button onClick={() => setVoiceEnabled(v => !v)}
              className={`p-2.5 rounded-xl transition-colors ${voiceEnabled ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
              {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>

          {isActive && (
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">LIVE</span>
            </div>
          )}
        </div>

        {/* Video + overlay canvas */}
        <div className="relative bg-black rounded-2xl overflow-hidden" style={{ minHeight: isActive ? 0 : 240 }}>
          <video
            ref={videoRef}
            autoPlay playsInline muted
            className="w-full block"
            style={{
              display: isActive ? 'block' : 'none',
              filter: `brightness(${brightness}%)${nightMode ? ' contrast(130%) saturate(70%)' : ''}`,
            }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ display: isActive ? 'block' : 'none', pointerEvents: 'none' }}
          />

          {!isActive && (
            <div className="aspect-video flex items-center justify-center">
              <div className="text-center">
                {!modelLoaded && !modelError
                  ? <Loader2 className="w-14 h-14 text-gray-600 mx-auto mb-3 animate-spin" />
                  : <Camera className="w-14 h-14 text-gray-600 mx-auto mb-3" />}
                <p className="text-gray-400 text-sm">
                  {!modelLoaded && !modelError ? 'Loading AI model…' : 'Press Start Camera to begin'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        {isActive && (
          <div className="flex flex-wrap gap-4 mt-3">
            {[
              { color: 'bg-green-500', label: 'Your object — normal location' },
              { color: 'bg-red-500',   label: 'Your object — unusual location ⚠' },
              ...(debugMode ? [{ color: 'bg-blue-500', label: 'Detected but not registered (debug)' }] : []),
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span className={`w-3 h-3 rounded-sm ${color} inline-block`} />{label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Live detection cards */}
      {registeredDetections.length > 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-500" />Your Objects Detected ({registeredDetections.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {registeredDetections.map((d, i) => (
              <div key={i} className={`rounded-2xl p-3 border ${
                d.isUnusual ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {d.isUnusual
                    ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    : <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                  <p className={`text-sm font-bold capitalize truncate ${d.isUnusual ? 'text-red-800 dark:text-red-300' : 'text-green-800 dark:text-green-300'}`}>
                    {d.displayName}
                  </p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{Math.round(d.score * 100)}% confidence</p>
                {d.isUnusual && d.usualLocation && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />Should be: {d.usualLocation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unusual activity log */}
      {unusualAlerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 rounded-3xl p-6">
          <h3 className="text-lg font-bold text-red-900 dark:text-red-300 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />Unusual Activity Log
          </h3>
          <div className="space-y-2">
            {unusualAlerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />{a}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registered objects panel */}
      {registeredObjects.length > 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" />
            Monitoring {registeredObjects.length} Object{registeredObjects.length !== 1 ? 's' : ''}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {registeredObjects.map(obj => (
              <div key={obj.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl px-2.5 py-2">
                {obj.image_url
                  ? <img src={obj.image_url} alt={obj.object_name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  : <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center shrink-0 text-lg">📦</div>}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate capitalize">{obj.object_name}</p>
                  {obj.usual_location && (
                    <p className="text-[10px] text-gray-400 flex items-center gap-0.5 truncate">
                      <MapPin className="w-2.5 h-2.5 shrink-0" />{obj.usual_location}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 space-y-2">
        <p className="text-sm text-blue-800 dark:text-blue-400">
          🔒 <strong>Privacy:</strong> All detection runs locally in your browser — no video is ever transmitted.
        </p>
        <p className="text-sm text-blue-800 dark:text-blue-400">
          💡 <strong>Not seeing boxes?</strong> Enable <strong>Debug mode</strong> — it shows everything the AI detects as blue boxes.
          If your object appears blue, rename it in your registered objects to match exactly what the AI calls it
          (e.g. "cell phone" not "mobile", "backpack" not "schoolbag").
        </p>
      </div>
    </div>
  );
}