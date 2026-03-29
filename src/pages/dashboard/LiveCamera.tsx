import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera, CameraOff, Volume2, VolumeX, AlertTriangle,
  CheckCircle2, Eye, MapPin, Clock, Loader2, Sun, Bug,
  Wifi, WifiOff, RefreshCw, Settings2, ZoomIn,
} from 'lucide-react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { showNotification } from '../../components/NotificationSystem';

// ─── Constants ─────────────────────────────────────────────────────────────────
const MIN_CONFIDENCE   = 0.45;  // global floor — keep low, per-class overrides handle accuracy
const STABILITY_FRAMES = 2;     // frames needed before reporting (lower = more responsive)
const ALERT_COOLDOWN   = 30_000; // ms between repeated alerts for same object
const DECAY_ON_MISS    = 1;      // how much to subtract from frameCount on a missed frame

// Per-class confidence overrides — noisy/ambiguous classes get higher thresholds
const CLASS_MIN_CONFIDENCE: Record<string, number> = {
  'person':        0.75,
  'toilet':        0.85,
  'book':          0.72,
  'tie':           0.70,
  'hair drier':    0.70,
  'toothbrush':    0.68,
  'remote':        0.65,
  'cell phone':    0.65,
  'keyboard':      0.65,
  'mouse':         0.65,
  'scissors':      0.65,
  'clock':         0.65,
  'vase':          0.65,
  'potted plant':  0.60,
  'teddy bear':    0.60,
};

// ─── Comprehensive alias map ────────────────────────────────────────────────────
// Keys = COCO class names (exact), values = all user-friendly names that map to it
// This covers ALL 80 COCO-SSD classes plus common everyday names people use
const CLASS_ALIASES: Record<string, string[]> = {
  // People
  'person': [
    'person','human','man','woman','boy','girl','child','kid','baby','infant',
    'adult','figure','individual','people','someone','somebody','user',
  ],

  // Vehicles
  'bicycle': [
    'bicycle','bike','cycle','pushbike','mtb','mountain bike','road bike',
    'bmx','two-wheeler',
  ],
  'car': [
    'car','vehicle','automobile','auto','sedan','hatchback','coupe','suv',
    'truck','van','jeep','cab','taxi',
  ],
  'motorcycle': [
    'motorcycle','motorbike','moped','scooter','bike','two-wheeler',
  ],
  'airplane': [
    'airplane','aircraft','plane','jet','aeroplane','flight','airliner',
  ],
  'bus': [
    'bus','coach','minibus','school bus','shuttle',
  ],
  'train': [
    'train','rail','metro','subway','tram','locomotive','railway',
  ],
  'truck': [
    'truck','lorry','pickup','pickup truck','semi','eighteen-wheeler','freight',
  ],
  'boat': [
    'boat','ship','vessel','canoe','kayak','rowboat','ferry','dinghy',
  ],

  // Outdoor
  'traffic light': [
    'traffic light','traffic signal','stoplight','signal light',
  ],
  'fire hydrant': [
    'fire hydrant','hydrant','fire plug',
  ],
  'stop sign': [
    'stop sign','stop',
  ],
  'parking meter': [
    'parking meter','meter',
  ],
  'bench': [
    'bench','park bench','seat','outdoor seat',
  ],

  // Animals
  'bird': [
    'bird','sparrow','pigeon','crow','parrot','chicken','hen','duck',
    'eagle','owl','robin','parakeet','budgie','canary',
  ],
  'cat': [
    'cat','kitten','kitty','feline','tabby','tomcat','pussycat',
  ],
  'dog': [
    'dog','puppy','pup','hound','canine','mutt','pooch','doggy',
  ],
  'horse': [
    'horse','pony','mare','stallion','foal','mustang',
  ],
  'sheep': [
    'sheep','lamb','ram','ewe',
  ],
  'cow': [
    'cow','bull','calf','cattle','ox','bovine',
  ],
  'elephant': [
    'elephant',
  ],
  'bear': [
    'bear','teddy','grizzly','polar bear',
  ],
  'zebra': [
    'zebra',
  ],
  'giraffe': [
    'giraffe',
  ],

  // Accessories
  'backpack': [
    'backpack','bag','school bag','rucksack','knapsack','daypack',
    'satchel','bookbag',
  ],
  'umbrella': [
    'umbrella','parasol','brolly',
  ],
  'handbag': [
    'handbag','purse','clutch','tote','tote bag','wallet','pocketbook',
    'shoulder bag','crossbody bag',
  ],
  'tie': [
    'tie','necktie','bow tie','cravat',
  ],
  'suitcase': [
    'suitcase','luggage','travel bag','trolley','baggage','valise','carry-on',
  ],

  // Sports
  'frisbee': [
    'frisbee','disc','flying disc',
  ],
  'skis': [
    'skis','ski','skiing',
  ],
  'snowboard': [
    'snowboard','snowboarding',
  ],
  'sports ball': [
    'sports ball','ball','football','soccer ball','basketball','tennis ball',
    'baseball','volleyball','rugby ball','cricket ball','handball',
  ],
  'kite': [
    'kite',
  ],
  'baseball bat': [
    'baseball bat','bat','cricket bat',
  ],
  'baseball glove': [
    'baseball glove','glove','mitt','oven mitt',
  ],
  'skateboard': [
    'skateboard','skate','longboard',
  ],
  'surfboard': [
    'surfboard','surf board','board',
  ],
  'tennis racket': [
    'tennis racket','racket','racquet','badminton racket',
  ],

  // Kitchen
  'bottle': [
    'bottle','water bottle','plastic bottle','glass bottle','flask',
    'drink bottle','sports bottle','squeeze bottle','sipper','tumbler bottle',
    'mineral water','drinking bottle',
  ],
  'wine glass': [
    'wine glass','glass','goblet','champagne glass','cocktail glass',
  ],
  'cup': [
    'cup','mug','coffee mug','tea cup','glass','tumbler','beaker','mug cup',
  ],
  'fork': [
    'fork','dinner fork','salad fork',
  ],
  'knife': [
    'knife','butter knife','kitchen knife','blade','cutter',
  ],
  'spoon': [
    'spoon','tablespoon','teaspoon','dessert spoon','ladle',
  ],
  'bowl': [
    'bowl','dish','cereal bowl','salad bowl','mixing bowl','soup bowl',
  ],
  'banana': [
    'banana',
  ],
  'apple': [
    'apple',
  ],
  'sandwich': [
    'sandwich','sub','burger','wrap','toast','grilled cheese',
  ],
  'orange': [
    'orange','tangerine','mandarin',
  ],
  'broccoli': [
    'broccoli','vegetable',
  ],
  'carrot': [
    'carrot',
  ],
  'hot dog': [
    'hot dog','hotdog','sausage','frankfurter',
  ],
  'pizza': [
    'pizza','pizza slice','pie',
  ],
  'donut': [
    'donut','doughnut','pastry','ring donut',
  ],
  'cake': [
    'cake','birthday cake','cupcake','muffin',
  ],

  // Furniture
  'chair': [
    'chair','seat','stool','armchair','office chair','dining chair',
    'folding chair','plastic chair',
  ],
  'couch': [
    'couch','sofa','settee','loveseat','sectional','lounge','divan',
  ],
  'potted plant': [
    'potted plant','plant','flower','succulent','cactus','houseplant',
    'indoor plant','vase plant','bonsai',
  ],
  'bed': [
    'bed','mattress','cot','bunk bed','sofa bed',
  ],
  'dining table': [
    'dining table','table','desk','coffee table','side table',
    'kitchen table','writing desk','study table',
  ],
  'toilet': [
    'toilet','commode','bathroom','lavatory','loo',
  ],

  // Electronics
  'tv': [
    'tv','television','monitor','screen','display','flat screen',
    'smart tv','lcd','led tv','projector screen',
  ],
  'laptop': [
    'laptop','computer','macbook','notebook','notebook computer',
    'pc','chromebook','surface','ultrabook',
  ],
  'mouse': [
    'mouse','computer mouse','trackpad','trackball',
  ],
  'remote': [
    'remote','tv remote','remote control','controller',
    'game controller','gamepad','joystick',
    'airpods','airpod','earbuds','earbud','earphones','earphone',
    'headphones','wireless earbuds','earpiece',
  ],
  'keyboard': [
    'keyboard','mechanical keyboard','wireless keyboard','numpad',
  ],
  'cell phone': [
    'cell phone','phone','mobile','smartphone','iphone','android',
    'samsung','pixel','oneplus','huawei','nokia','mobile phone',
    'handset',
  ],
  'microwave': [
    'microwave','microwave oven','oven microwave',
  ],
  'oven': [
    'oven','stove','range','cooker','gas oven',
  ],
  'toaster': [
    'toaster','bread toaster',
  ],
  'sink': [
    'sink','basin','washbasin','kitchen sink','bathroom sink',
  ],
  'refrigerator': [
    'refrigerator','fridge','freezer','icebox','cooler',
  ],
  'book': [
    'book','textbook','novel','diary','journal','notebook',
    'magazine','comic','paperback','hardcover','manual',
  ],
  'clock': [
    'clock','wall clock','alarm clock','watch','timepiece',
  ],
  'vase': [
    'vase','flower vase','pot',
  ],
  'scissors': [
    'scissors','shears',
  ],
  'teddy bear': [
    'teddy bear','teddy','stuffed animal','stuffed toy','plush',
    'plush toy','soft toy',
  ],
  'hair drier': [
    'hair drier','hairdryer','hair dryer','blow dryer',
  ],
  'toothbrush': [
    'toothbrush','brush','electric toothbrush',
  ],
};

// Build reverse lookup: user word → COCO class
// e.g. "water bottle" → "bottle", "macbook" → "laptop"
const REVERSE_ALIAS: Record<string, string> = {};
for (const [cocoClass, aliases] of Object.entries(CLASS_ALIASES)) {
  for (const alias of aliases) {
    REVERSE_ALIAS[alias.toLowerCase().trim()] = cocoClass;
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────
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

interface Room {
  id: string;
  room_name: string;
  floor: string;
  image_url: string;
}

// ─── Matching logic ─────────────────────────────────────────────────────────────
function findMatch(
  cocoClass: string,
  objects: RegisteredObject[],
): RegisteredObject | undefined {
  const cl = cocoClass.toLowerCase().trim();

  for (const obj of objects) {
    const nl = obj.object_name.toLowerCase().trim();

    // 1. Exact match
    if (nl === cl) return obj;

    // 2. Substring match (either direction)
    if (nl.includes(cl) || cl.includes(nl)) return obj;

    // 3. Aliases for COCO class contain the user's registered name
    const cocoAliases = CLASS_ALIASES[cl] ?? [];
    if (cocoAliases.some(a => {
      const al = a.toLowerCase().trim();
      return al === nl || al.includes(nl) || nl.includes(al);
    })) return obj;

    // 4. Reverse lookup: user's registered name maps to this COCO class
    // e.g. user registered "water bottle" → REVERSE_ALIAS["water bottle"] = "bottle"
    const mappedClass = REVERSE_ALIAS[nl];
    if (mappedClass && mappedClass === cl) return obj;

    // 5. Word-level partial: any word in user's name appears in COCO class or vice versa
    const userWords  = nl.split(/[\s\-_]+/).filter(w => w.length > 2);
    const cocoWords  = cl.split(/[\s\-_]+/).filter(w => w.length > 2);
    const allAliasWords = cocoAliases.flatMap(a => a.split(/[\s\-_]+/).filter(w => w.length > 2));
    if (userWords.some(uw => cocoWords.includes(uw) || allAliasWords.includes(uw))) return obj;
  }
  return undefined;
}

// ─── Canvas drawing ─────────────────────────────────────────────────────────────
function drawDetectionBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string,
  label: string,
  subLabel: string,
) {
  // Glow + main box
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur  = 12;
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2.5;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();

  // Corner brackets
  const bs = Math.min(20, w * 0.18, h * 0.18);
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 6;
  ctx.beginPath();
  ctx.moveTo(x, y + bs);     ctx.lineTo(x, y);       ctx.lineTo(x + bs, y);
  ctx.moveTo(x+w-bs, y);     ctx.lineTo(x+w, y);     ctx.lineTo(x+w, y+bs);
  ctx.moveTo(x, y+h-bs);     ctx.lineTo(x, y+h);     ctx.lineTo(x+bs, y+h);
  ctx.moveTo(x+w-bs, y+h);   ctx.lineTo(x+w, y+h);   ctx.lineTo(x+w, y+h-bs);
  ctx.stroke();
  ctx.restore();

  // Label background
  ctx.save();
  ctx.font = 'bold 12px "SF Pro Display", system-ui, sans-serif';
  ctx.textBaseline = 'top';
  const pad  = 6;
  const lh   = 17;
  const lw   = ctx.measureText(label).width + pad * 2;
  const slw  = ctx.measureText(subLabel).width + pad * 2;
  const boxW = Math.max(lw, slw);
  const boxH = lh * 2 + pad * 2;
  const ly   = y >= boxH + 4 ? y - boxH - 4 : y + h + 2;

  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur  = 8;
  ctx.fillStyle   = color;
  if (ctx.roundRect) ctx.roundRect(x, ly, boxW, boxH, 5);
  else ctx.rect(x, ly, boxW, boxH);
  ctx.fill();
  ctx.restore();

  // Label text
  ctx.save();
  ctx.font = 'bold 12px "SF Pro Display", system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label,    x + pad, ly + pad);
  ctx.font = '11px "SF Pro Display", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText(subLabel, x + pad, ly + pad + lh);
  ctx.restore();
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function LiveCamera() {
  const { user } = useAuth();

  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const modelRef    = useRef<cocoSsd.ObjectDetection | null>(null);
  const rafRef      = useRef<number>(0);
  const isRunning   = useRef(false);
  const lastAlertRef  = useRef<Record<string, number>>({});
  const frameCountRef = useRef<Record<string, number>>({});

  const [modelLoaded,   setModelLoaded]   = useState(false);
  const [modelError,    setModelError]    = useState('');
  const [modelLoading,  setModelLoading]  = useState(true);
  const [isActive,      setIsActive]      = useState(false);
  const [cameraError,   setCameraError]   = useState('');
  const [voiceEnabled,  setVoiceEnabled]  = useState(true);
  const [nightMode,     setNightMode]     = useState(false);
  const [brightness,    setBrightness]    = useState(100);
  const [debugMode,     setDebugMode]     = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [zoomLevel,     setZoomLevel]     = useState(1);
  const [detections,    setDetections]    = useState<Detection[]>([]);
  const [unusualAlerts, setUnusualAlerts] = useState<string[]>([]);
  const [registeredObjects, setRegisteredObjects] = useState<RegisteredObject[]>([]);
  const [rooms,         setRooms]         = useState<Room[]>([]);
  const [selectedRoom,  setSelectedRoom]  = useState<Room | null>(null);
  const [fps,           setFps]           = useState(0);
  const [, setTotalDetected] = useState(0);

  // FPS counter
  const fpsFrames  = useRef(0);
  const fpsTimer   = useRef(0);

  // ── Model load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setModelLoading(true);
    (async () => {
      try {
        const m = await cocoSsd.load({ base: 'mobilenet_v2' });
        if (!cancelled) {
          modelRef.current = m;
          setModelLoaded(true);
          setModelLoading(false);
        }
      } catch {
        if (!cancelled) {
          setModelError('Failed to load AI model. Please refresh.');
          setModelLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data fetching ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from('objects')
      .select('id, object_name, usual_location, last_known_location, image_url')
      .eq('user_id', user.id)
      .then(({ data }) => { if (data) setRegisteredObjects(data as RegisteredObject[]); });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('rooms')
      .select('id, room_name, floor, image_url')
      .eq('user_id', user.id)
      .order('floor').order('room_name')
      .then(({ data }) => { if (data) setRooms(data as Room[]); });
  }, [user]);

  // ── Auto-start ──────────────────────────────────────────────────────────────
  const autoStartDoneRef = useRef(false);
  useEffect(() => {
    if (!user || !modelLoaded || autoStartDoneRef.current) return;
    supabase
      .from('user_preferences')
      .select('camera_detection_enabled')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.camera_detection_enabled && !isRunning.current) {
          autoStartDoneRef.current = true;
          setTimeout(() => startCamera(), 500);
        }
      });
  }, [user, modelLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Speech ──────────────────────────────────────────────────────────────────
  const lastSpoken = useRef('');
  const speak = useCallback((text: string) => {
    if (!voiceEnabled || text === lastSpoken.current) return;
    lastSpoken.current = text;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate  = 0.95;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
    }
  }, [voiceEnabled]);

  // ── Activity log ────────────────────────────────────────────────────────────
  const logDetection = useCallback(async (
    obj: RegisteredObject, confidence: number, isUnusual: boolean, loc: string,
  ) => {
    if (!user) return;
    const now = Date.now();
    if (now - (lastAlertRef.current[obj.id] ?? 0) < ALERT_COOLDOWN) return;
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

  const debugModeRef = useRef(debugMode);
  useEffect(() => { debugModeRef.current = debugMode; }, [debugMode]);

  // ── Detection loop ──────────────────────────────────────────────────────────
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
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width  = vw;
      canvas.height = vh;
    }

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, vw, vh);

    // FPS tracking
    fpsFrames.current++;
    const now = performance.now();
    if (now - fpsTimer.current >= 1000) {
      setFps(fpsFrames.current);
      fpsFrames.current = 0;
      fpsTimer.current  = now;
    }

    let preds: cocoSsd.DetectedObject[] = [];
    try {
      preds = await model.detect(video);
    } catch {
      if (isRunning.current) rafRef.current = requestAnimationFrame(runDetection);
      return;
    }

    const currentLocation = selectedRoom
      ? `${selectedRoom.room_name} (${selectedRoom.floor})`
      : 'Unknown Room';

    const newDetections: Detection[] = [];
    const seenClasses = new Set<string>();

    for (const pred of preds) {
      // Global confidence floor
      if (pred.score < MIN_CONFIDENCE) continue;
      // Per-class confidence floor
      if (pred.score < (CLASS_MIN_CONFIDENCE[pred.class] ?? 0)) continue;

      const [bx, by, bw, bh] = pred.bbox;
      seenClasses.add(pred.class);

      // Increment stability counter
      frameCountRef.current[pred.class] = (frameCountRef.current[pred.class] ?? 0) + 1;
      // Require STABILITY_FRAMES before acting
      if (frameCountRef.current[pred.class] < STABILITY_FRAMES) continue;

      const matched      = findMatch(pred.class, registeredObjects);
      const isRegistered = !!matched;
      let   isUnusual    = false;
      const displayName  = matched?.object_name ?? pred.class;

      if (matched) {
        const usual = (matched.usual_location || '').toLowerCase().trim();
        if (usual && !currentLocation.toLowerCase().includes(usual)) {
          isUnusual = true;
        }

        // Unusual alert (voice + notification + log)
        const alertKey = matched.id + '_alert';
        const alertNow = Date.now();
        if (isUnusual && alertNow - (lastAlertRef.current[alertKey] ?? 0) > ALERT_COOLDOWN) {
          lastAlertRef.current[alertKey] = alertNow;
          showNotification(
            'Unusual Activity Detected',
            `"${matched.object_name}" found in unexpected location! Usually at: ${matched.usual_location}`,
            'warning', true,
          );
          speak(
            `Alert! ${matched.object_name} found in unusual location. It should be at ${matched.usual_location}.`,
          );
          setUnusualAlerts(prev =>
            [`${matched.object_name} — found here (usual: ${matched.usual_location})`, ...prev].slice(0, 10),
          );
        }
        logDetection(matched, pred.score, isUnusual, currentLocation);
      }

      // Debug info overlay
      const conf = Math.round(pred.score * 100);
      const label    = `${displayName.toUpperCase()}  ${conf}%`;
      const subLabel = isRegistered
        ? (isUnusual ? `⚠ Should be: ${matched!.usual_location}` : '✓ Normal location')
        : (debugModeRef.current ? `COCO: ${pred.class}` : 'Unregistered');

      const color = isRegistered
        ? (isUnusual ? '#EF4444' : '#10B981')
        : '#3B82F6';

      drawDetectionBox(ctx, bx, by, bw, bh, color, label, subLabel);

      newDetections.push({
        cocoClass: pred.class, displayName, score: pred.score,
        bbox: pred.bbox as [number,number,number,number],
        isRegistered, isUnusual,
        usualLocation: matched?.usual_location,
      });
    }

    // Decay (not hard-reset) missing classes
    for (const cls of Object.keys(frameCountRef.current)) {
      if (!seenClasses.has(cls)) {
        frameCountRef.current[cls] = Math.max(
          0,
          (frameCountRef.current[cls] ?? 0) - DECAY_ON_MISS,
        );
      }
    }

    setDetections(newDetections);
    setTotalDetected(n => n + newDetections.length);

    if (isRunning.current) rafRef.current = requestAnimationFrame(runDetection);
  }, [registeredObjects, selectedRoom, speak, logDetection]);

  // ── Camera start / stop ─────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const ms = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = ms;
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        await videoRef.current.play();
      }
      isRunning.current = true;
      fpsFrames.current = 0;
      fpsTimer.current  = performance.now();
      setIsActive(true);
      setTotalDetected(0);
      speak('Camera started. Scanning for objects.');
      rafRef.current = requestAnimationFrame(runDetection);
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      setCameraError(
        name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : name === 'NotFoundError'
            ? 'No camera found. Please connect a camera and try again.'
            : 'Could not access camera. Make sure no other app is using it.',
      );
    }
  }, [runDetection, speak]);

  const stopCamera = useCallback(() => {
    isRunning.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const cvs = canvasRef.current;
    if (cvs) cvs.getContext('2d')?.clearRect(0, 0, cvs.width, cvs.height);
    frameCountRef.current = {};
    setIsActive(false);
    setDetections([]);
    setFps(0);
    window.speechSynthesis?.cancel();
  }, []);

  // Re-run detection when registered objects change
  useEffect(() => {
    if (isActive) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(runDetection);
    }
  }, [registeredObjects, runDetection, isActive]);

  // ── Derived state ───────────────────────────────────────────────────────────
  const registeredDetections   = detections.filter(d => d.isRegistered);
  const unregisteredDetections = detections.filter(d => !d.isRegistered);
  const unusual                = registeredDetections.filter(d => d.isUnusual);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
          Live Camera Detection
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Detects all 80 COCO objects · matches your registered items by name, alias, or keyword
        </p>
      </div>

      {/* Status banners */}
      {modelLoading && !modelError && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">Loading AI detection model (MobileNet v2)…</p>
        </div>
      )}
      {modelError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-400">{modelError}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 dark:text-red-400"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}
      {cameraError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <WifiOff className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{cameraError}</p>
        </div>
      )}
      {modelLoaded && registeredObjects.length === 0 && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            No registered objects.{' '}
            <a href="/dashboard/add-object" className="underline font-semibold">Add objects</a>
            {' '}to track them — unregistered objects will still show in blue.
          </p>
        </div>
      )}

      {/* Live stats */}
      {isActive && (
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: 'Your Objects', value: registeredDetections.length,
              icon: Eye, c: 'blue',
            },
            {
              label: 'Normal', value: registeredDetections.filter(d => !d.isUnusual).length,
              icon: CheckCircle2, c: 'green',
            },
            {
              label: 'Unusual', value: unusual.length,
              icon: AlertTriangle, c: 'red',
            },
            {
              label: 'Other Objects', value: unregisteredDetections.length,
              icon: Bug, c: 'gray',
            },
          ].map(({ label, value, icon: Icon, c }) => (
            <div
              key={label}
              className={`bg-${c}-50 dark:bg-${c}-900/20 border border-${c}-200 dark:border-${c}-700 rounded-2xl p-3 flex items-center gap-3`}
            >
              <Icon className={`w-5 h-5 text-${c}-500 shrink-0`} />
              <div>
                <p className={`text-xl font-bold text-${c}-700 dark:text-${c}-400`}>{value}</p>
                <p className={`text-xs text-${c}-600 dark:text-${c}-500`}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Room selector */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Which room is this camera in?
          </h3>
        </div>

        {rooms.length === 0 ? (
          <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              No rooms yet.{' '}
              <a href="/dashboard/rooms" className="underline font-semibold">Add rooms</a>
              {' '}to enable location-based unusual-activity detection.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(r => r?.id === room.id ? null : room)}
                className={`relative rounded-2xl overflow-hidden border-2 transition-all text-left ${
                  selectedRoom?.id === room.id
                    ? 'border-blue-500 ring-2 ring-blue-500/30 scale-[1.02]'
                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                }`}
              >
                <div className="h-20 bg-gray-100 dark:bg-gray-700 relative">
                  {room.image_url
                    ? <img src={room.image_url} alt={room.room_name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">🏠</div>
                  }
                  {selectedRoom?.id === room.id && (
                    <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-2.5 py-1.5">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{room.room_name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{room.floor}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedRoom && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Camera set to: <strong>{selectedRoom.room_name}</strong> — {selectedRoom.floor}
            </p>
          </div>
        )}
      </div>

      {/* Camera panel */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">

        {/* Controls bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">

            {/* Start / Stop */}
            <button
              onClick={isActive ? stopCamera : startCamera}
              disabled={!modelLoaded}
              className={`px-5 py-2.5 rounded-2xl font-semibold flex items-center gap-2 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-green-500/30'
              }`}
            >
              {isActive
                ? <><CameraOff className="w-4 h-4" />Stop</>
                : <><Camera className="w-4 h-4" />Start Camera</>
              }
            </button>

            {/* Settings toggle */}
            <button
              onClick={() => setShowSettings(v => !v)}
              className={`p-2.5 rounded-xl transition-colors ${
                showSettings
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
              }`}
              title="Camera settings"
            >
              <Settings2 className="w-4 h-4" />
            </button>

            {/* Voice */}
            <button
              onClick={() => setVoiceEnabled(v => !v)}
              className={`p-2.5 rounded-xl transition-colors ${
                voiceEnabled
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
              }`}
              title={voiceEnabled ? 'Mute voice alerts' : 'Enable voice alerts'}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Debug */}
            <button
              onClick={() => setDebugMode(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-colors ${
                debugMode
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
              }`}
            >
              <Bug className="w-3.5 h-3.5" />Debug
            </button>
          </div>

          {/* Live badge + FPS */}
          {isActive && (
            <div className="flex items-center gap-3">
              {debugMode && (
                <span className="text-xs text-gray-400 font-mono">{fps} fps</span>
              )}
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-red-600 dark:text-red-400">LIVE</span>
              </div>
            </div>
          )}
        </div>

        {/* Expanded settings */}
        {showSettings && (
          <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-2xl text-sm">
            {/* Night mode */}
            <button
              onClick={() => setNightMode(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-colors ${
                nightMode
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-500'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />Night Mode
            </button>

            {/* Brightness */}
            <div className="flex items-center gap-2">
              <Sun className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500 w-16">Brightness</span>
              <input
                type="range" min={50} max={250} value={brightness}
                onChange={e => setBrightness(Number(e.target.value))}
                className="w-24 accent-yellow-400"
              />
              <span className="text-xs text-gray-400 w-8">{brightness}%</span>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-2">
              <ZoomIn className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500 w-8">Zoom</span>
              <input
                type="range" min={1} max={3} step={0.1} value={zoomLevel}
                onChange={e => setZoomLevel(Number(e.target.value))}
                className="w-24 accent-blue-400"
              />
              <span className="text-xs text-gray-400 w-8">{zoomLevel.toFixed(1)}×</span>
            </div>
          </div>
        )}

        {/* Video + canvas */}
        <div
          className="relative bg-black rounded-2xl overflow-hidden"
          style={{ minHeight: isActive ? 0 : 240 }}
        >
          <video
            ref={videoRef}
            autoPlay playsInline muted
            className="w-full block"
            style={{
              display:    isActive ? 'block' : 'none',
              transform:  zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
              transformOrigin: 'center center',
              filter: `brightness(${brightness}%)${nightMode ? ' contrast(140%) saturate(60%) hue-rotate(200deg)' : ''}`,
            }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{
              display: isActive ? 'block' : 'none',
              pointerEvents: 'none',
            }}
          />
          {!isActive && (
            <div className="aspect-video flex items-center justify-center">
              <div className="text-center">
                {modelLoading && !modelError
                  ? <Loader2 className="w-14 h-14 text-gray-500 mx-auto mb-3 animate-spin" />
                  : <Camera className="w-14 h-14 text-gray-500 mx-auto mb-3" />
                }
                <p className="text-gray-400 text-sm">
                  {modelLoading && !modelError ? 'Loading AI model…' : 'Press Start Camera to begin'}
                </p>
                {modelLoaded && (
                  <p className="text-xs text-gray-500 mt-1">
                    Monitoring {registeredObjects.length} registered object{registeredObjects.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        {isActive && (
          <div className="flex flex-wrap gap-4 mt-3">
            {[
              { color: 'bg-green-500', label: 'Your object — normal location' },
              { color: 'bg-red-500',   label: 'Your object — wrong location ⚠' },
              { color: 'bg-blue-500',  label: 'Detected object (not registered)' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span className={`w-3 h-3 rounded-sm ${color} inline-block shrink-0`} />{label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Registered objects detected */}
      {registeredDetections.length > 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-500" />
            Your Objects Detected ({registeredDetections.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {registeredDetections.map((d, i) => (
              <div
                key={i}
                className={`rounded-2xl p-3 border ${
                  d.isUnusual
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                    : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {d.isUnusual
                    ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    : <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  }
                  <p className={`text-sm font-bold capitalize truncate ${
                    d.isUnusual
                      ? 'text-red-800 dark:text-red-300'
                      : 'text-green-800 dark:text-green-300'
                  }`}>
                    {d.displayName}
                  </p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {Math.round(d.score * 100)}% confidence
                  {debugMode && <span className="ml-1 opacity-60">[{d.cocoClass}]</span>}
                </p>
                {d.isUnusual && d.usualLocation && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />Should be: {d.usualLocation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unregistered objects detected */}
      {unregisteredDetections.length > 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-5 border border-blue-200 dark:border-blue-800 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-blue-500" />
            Other Detected Objects ({unregisteredDetections.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {unregisteredDetections.map((d, i) => (
              <div
                key={i}
                className="rounded-2xl p-3 border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold capitalize truncate text-blue-800 dark:text-blue-300">
                    {d.cocoClass}
                  </p>
                  <p className="text-xs text-gray-400">{Math.round(d.score * 100)}% confident</p>
                </div>
                <a
                  href="/dashboard/add-object"
                  className="text-[10px] shrink-0 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  + Track
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unusual activity log */}
      {unusualAlerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 rounded-3xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-red-900 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />Unusual Activity Log
            </h3>
            <button
              onClick={() => setUnusualAlerts([])}
              className="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="space-y-2">
            {unusualAlerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                {a}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monitored objects list */}
      {registeredObjects.length > 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" />
            Monitoring {registeredObjects.length} Object{registeredObjects.length !== 1 ? 's' : ''}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {registeredObjects.map(obj => {
              const isCurrentlyDetected = registeredDetections.some(
                d => d.displayName.toLowerCase() === obj.object_name.toLowerCase()
              );
              return (
                <div
                  key={obj.id}
                  className={`flex items-center gap-2 rounded-xl px-2.5 py-2 transition-colors ${
                    isCurrentlyDetected
                      ? 'bg-green-50 dark:bg-green-900/20 ring-1 ring-green-300 dark:ring-green-700'
                      : 'bg-gray-50 dark:bg-gray-700/50'
                  }`}
                >
                  {obj.image_url
                    ? <img src={obj.image_url} alt={obj.object_name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                    : <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center shrink-0 text-lg">📦</div>
                  }
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate capitalize">
                      {obj.object_name}
                    </p>
                    {obj.usual_location && (
                      <p className="text-[10px] text-gray-400 flex items-center gap-0.5 truncate">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />{obj.usual_location}
                      </p>
                    )}
                    {isCurrentlyDetected && (
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">● visible</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info / tips */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 space-y-2">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          🔒 <strong>Privacy:</strong> All detection runs locally in your browser — no video is ever uploaded.
        </p>
        <p className="text-sm text-blue-800 dark:text-blue-300">
          🔍 <strong>Naming tip:</strong> Use common names for best matching — e.g.{' '}
          <em>"bottle"</em> or <em>"water bottle"</em> (not "Nalgene"), <em>"laptop"</em> (not "MacBook"),{' '}
          <em>"cell phone"</em> or <em>"phone"</em> (not "iPhone 15"). The detector understands{' '}
          <strong>{Object.values(CLASS_ALIASES).reduce((n, a) => n + a.length, 0)}+ aliases</strong> across all {Object.keys(CLASS_ALIASES).length} object classes.
        </p>
        {debugMode && (
          <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">
            Debug: COCO class shown in brackets · confidence floor: {MIN_CONFIDENCE} global,
            per-class overrides for {Object.keys(CLASS_MIN_CONFIDENCE).length} noisy classes ·
            stability: {STABILITY_FRAMES} frames · decay: −{DECAY_ON_MISS}/miss
          </p>
        )}
      </div>
    </div>
  );
}