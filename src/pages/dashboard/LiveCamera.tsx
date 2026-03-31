import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera, CameraOff, Volume2, VolumeX, AlertTriangle,
  CheckCircle2, Eye, MapPin, Clock, Loader2, Sun, Bug,
  Wifi, WifiOff, RefreshCw, Settings2, ZoomIn, Sparkles,
} from 'lucide-react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { showNotification } from '../../components/NotificationSystem';

// ─── Constants ──────────────────────────────────────────────────────────────────
const MIN_CONFIDENCE       = 0.45;
const STABILITY_FRAMES     = 2;
const ALERT_COOLDOWN       = 30_000;
const DECAY_ON_MISS        = 1;
const CLAUDE_SCAN_INTERVAL = 5_000;

const CLASS_MIN_CONFIDENCE: Record<string, number> = {
  'person': 0.75, 'toilet': 0.85, 'book': 0.72, 'tie': 0.70,
  'hair drier': 0.70, 'toothbrush': 0.68, 'remote': 0.65,
  'cell phone': 0.65, 'keyboard': 0.65, 'mouse': 0.65,
  'scissors': 0.65, 'clock': 0.65, 'vase': 0.65,
  'potted plant': 0.60, 'teddy bear': 0.60,
};

// ─── Alias map ──────────────────────────────────────────────────────────────────
const CLASS_ALIASES: Record<string, string[]> = {
  'person': ['person','human','man','woman','boy','girl','child','kid','baby','infant','adult','figure','individual','people','someone','somebody','user'],
  'bicycle': ['bicycle','bike','cycle','pushbike','mtb','mountain bike','road bike','bmx','two-wheeler'],
  'car': ['car','vehicle','automobile','auto','sedan','hatchback','coupe','suv','van','jeep','cab','taxi'],
  'motorcycle': ['motorcycle','motorbike','moped','scooter'],
  'airplane': ['airplane','aircraft','plane','jet','aeroplane'],
  'bus': ['bus','coach','minibus','school bus','shuttle'],
  'train': ['train','rail','metro','subway','tram','locomotive'],
  'truck': ['truck','lorry','pickup','pickup truck','semi'],
  'boat': ['boat','ship','vessel','canoe','kayak','rowboat','ferry'],
  'traffic light': ['traffic light','traffic signal','stoplight'],
  'fire hydrant': ['fire hydrant','hydrant'],
  'stop sign': ['stop sign','stop'],
  'parking meter': ['parking meter','meter'],
  'bench': ['bench','park bench','outdoor seat'],
  'bird': ['bird','sparrow','pigeon','crow','parrot','chicken','hen','duck','eagle','owl'],
  'cat': ['cat','kitten','kitty','feline','tabby','tomcat'],
  'dog': ['dog','puppy','pup','hound','canine','mutt','pooch'],
  'horse': ['horse','pony','mare','stallion'],
  'sheep': ['sheep','lamb','ram','ewe'],
  'cow': ['cow','bull','calf','cattle','ox','bovine'],
  'elephant': ['elephant'],
  'bear': ['bear','grizzly','polar bear'],
  'zebra': ['zebra'],
  'giraffe': ['giraffe'],
  'backpack': ['backpack','bag','school bag','rucksack','knapsack','daypack','satchel','bookbag'],
  'umbrella': ['umbrella','parasol','brolly'],
  'handbag': ['handbag','purse','clutch','tote','tote bag','pocketbook','shoulder bag','crossbody bag','money purse','wallet','pouch'],
  'tie': ['tie','necktie','bow tie','cravat'],
  'suitcase': ['suitcase','luggage','travel bag','trolley','baggage','valise','carry-on'],
  'frisbee': ['frisbee','disc'],
  'skis': ['skis','ski'],
  'snowboard': ['snowboard'],
  'sports ball': ['sports ball','ball','football','soccer ball','basketball','tennis ball','baseball','volleyball'],
  'kite': ['kite'],
  'baseball bat': ['baseball bat','bat','cricket bat'],
  'baseball glove': ['baseball glove','glove','mitt'],
  'skateboard': ['skateboard','skate','longboard'],
  'surfboard': ['surfboard'],
  'tennis racket': ['tennis racket','racket','racquet','badminton racket'],
  'bottle': ['bottle','water bottle','plastic bottle','glass bottle','flask','drink bottle','sports bottle','sipper','tumbler bottle','mineral water','drinking bottle','purple bottle','red bottle','blue bottle'],
  'wine glass': ['wine glass','goblet','champagne glass','cocktail glass'],
  'cup': ['cup','mug','coffee mug','tea cup','tumbler','beaker'],
  'fork': ['fork','dinner fork'],
  'knife': ['knife','kitchen knife','blade','cutter'],
  'spoon': ['spoon','tablespoon','teaspoon','ladle'],
  'bowl': ['bowl','dish','cereal bowl','salad bowl','mixing bowl','soup bowl'],
  'banana': ['banana'],
  'apple': ['apple'],
  'sandwich': ['sandwich','sub','burger','wrap','toast'],
  'orange': ['orange','tangerine','mandarin'],
  'broccoli': ['broccoli','vegetable'],
  'carrot': ['carrot'],
  'hot dog': ['hot dog','hotdog','sausage','frankfurter'],
  'pizza': ['pizza','pizza slice'],
  'donut': ['donut','doughnut','pastry'],
  'cake': ['cake','birthday cake','cupcake','muffin'],
  'chair': ['chair','seat','stool','armchair','office chair','dining chair','folding chair'],
  'couch': ['couch','sofa','settee','loveseat','sectional','lounge'],
  'potted plant': ['potted plant','plant','flower','succulent','cactus','houseplant','indoor plant'],
  'bed': ['bed','mattress','cot','bunk bed'],
  'dining table': ['dining table','table','desk','coffee table','side table','kitchen table','writing desk','study table'],
  'toilet': ['toilet','commode','lavatory','loo'],
  'tv': ['tv','television','monitor','screen','display','flat screen','smart tv','lcd','led tv'],
  'laptop': ['laptop','computer','macbook','notebook','notebook computer','pc','chromebook','surface','ultrabook'],
  'mouse': ['mouse','computer mouse','trackpad','trackball'],
  'remote': ['remote','tv remote','remote control','controller','calculator','black calculator','scientific calculator','basic calculator'],
  'keyboard': ['keyboard','mechanical keyboard','wireless keyboard','numpad'],
  'cell phone': ['cell phone','phone','mobile','smartphone','iphone','android','samsung','pixel','oneplus','huawei','nokia','mobile phone','handset'],
  'microwave': ['microwave','microwave oven'],
  'oven': ['oven','stove','range','cooker'],
  'toaster': ['toaster','bread toaster'],
  'sink': ['sink','basin','washbasin','kitchen sink','bathroom sink'],
  'refrigerator': ['refrigerator','fridge','freezer','icebox','cooler'],
  'book': ['book','textbook','novel','diary','journal','notebook','magazine','comic','paperback','hardcover','manual','computer graphics note book','note book','notes','graphics book','graphics notebook'],
  'clock': ['clock','wall clock','alarm clock','watch','timepiece','wristwatch','smartwatch','apple watch','analog watch'],
  'vase': ['vase','flower vase','pot'],
  'scissors': ['scissors','shears'],
  'teddy bear': ['teddy bear','teddy','stuffed animal','stuffed toy','plush','plush toy','soft toy'],
  'hair drier': ['hair drier','hairdryer','hair dryer','blow dryer'],
  'toothbrush': ['toothbrush','brush','electric toothbrush'],
};

const REVERSE_ALIAS: Record<string, string> = {};
for (const [cocoClass, aliases] of Object.entries(CLASS_ALIASES)) {
  for (const alias of aliases) {
    REVERSE_ALIAS[alias.toLowerCase().trim()] = cocoClass;
  }
}

function isCocoDetectable(objectName: string): boolean {
  const nl = objectName.toLowerCase().trim();
  if (CLASS_ALIASES[nl]) return true;
  if (REVERSE_ALIAS[nl]) return true;
  for (const [cocoClass, aliases] of Object.entries(CLASS_ALIASES)) {
    if (cocoClass.includes(nl) || nl.includes(cocoClass)) return true;
    if (aliases.some(a => {
      const al = a.toLowerCase();
      return al === nl || al.includes(nl) || nl.includes(al);
    })) return true;
  }
  return false;
}

// ─── Types ───────────────────────────────────────────────────────────────────────
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
  registeredObjId?: string;
  source: 'coco' | 'claude';
}

interface ClaudeResult {
  objectId: string;
  objectName: string;
  found: boolean;
  confidence: 'high' | 'medium' | 'low';
  location_hint?: string;
}

interface Room {
  id: string;
  room_name: string;
  floor: string;
  image_url: string;
}

// ─── findMatch ───────────────────────────────────────────────────────────────────
function findMatch(cocoClass: string, objects: RegisteredObject[]): RegisteredObject | undefined {
  const cl = cocoClass.toLowerCase().trim();
  for (const obj of objects) {
    const nl = obj.object_name.toLowerCase().trim();
    if (nl === cl) return obj;
    if (nl.includes(cl) || cl.includes(nl)) return obj;
    const cocoAliases = CLASS_ALIASES[cl] ?? [];
    if (cocoAliases.some(a => {
      const al = a.toLowerCase().trim();
      return al === nl || al.includes(nl) || nl.includes(al);
    })) return obj;
    const mappedClass = REVERSE_ALIAS[nl];
    if (mappedClass && mappedClass === cl) return obj;
    const userWords = nl.split(/[\s\-_]+/).filter(w => w.length > 2);
    const cocoWords = cl.split(/[\s\-_]+/).filter(w => w.length > 2);
    const allAliasWords = cocoAliases.flatMap(a => a.split(/[\s\-_]+/).filter(w => w.length > 2));
    if (userWords.some(uw => cocoWords.includes(uw) || allAliasWords.includes(uw))) return obj;
  }
  return undefined;
}

// ─── Canvas drawing ───────────────────────────────────────────────────────────────
function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string, label: string, subLabel: string,
  dashed = false,
) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur  = dashed ? 22 : 14;
  ctx.strokeStyle = color;
  ctx.lineWidth   = dashed ? 3 : 2.5;
  if (dashed) ctx.setLineDash([10, 5]);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();

  const bs = Math.min(22, w * 0.2, h * 0.2);
  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 8;
  ctx.beginPath();
  ctx.moveTo(x, y + bs);     ctx.lineTo(x, y);     ctx.lineTo(x + bs, y);
  ctx.moveTo(x+w-bs, y);     ctx.lineTo(x+w, y);   ctx.lineTo(x+w, y+bs);
  ctx.moveTo(x, y+h-bs);     ctx.lineTo(x, y+h);   ctx.lineTo(x+bs, y+h);
  ctx.moveTo(x+w-bs, y+h);   ctx.lineTo(x+w, y+h); ctx.lineTo(x+w, y+h-bs);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.font = 'bold 12px "SF Pro Display", system-ui, sans-serif';
  ctx.textBaseline = 'top';
  const pad  = 7;
  const lh   = 16;
  const lw1  = ctx.measureText(label).width + pad * 2;
  const lw2  = ctx.measureText(subLabel).width + pad * 2;
  const bw2  = Math.max(lw1, lw2);
  const bh2  = lh * 2 + pad * 2;
  const ly   = y >= bh2 + 4 ? y - bh2 - 4 : y + h + 2;

  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur  = 10;
  ctx.fillStyle   = color;
  if (ctx.roundRect) ctx.roundRect(x, ly, bw2, bh2, 6);
  else ctx.rect(x, ly, bw2, bh2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.font = 'bold 12px "SF Pro Display", system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText(label, x + pad, ly + pad);
  ctx.font = '11px "SF Pro Display", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(subLabel, x + pad, ly + pad + lh);
  ctx.restore();
}

function captureFrame(video: HTMLVideoElement, maxW = 720): string | null {
  try {
    const scale = Math.min(1, maxW / (video.videoWidth || 640));
    const cvs = document.createElement('canvas');
    cvs.width  = Math.round((video.videoWidth  || 640) * scale);
    cvs.height = Math.round((video.videoHeight || 480) * scale);
    cvs.getContext('2d')?.drawImage(video, 0, 0, cvs.width, cvs.height);
    return cvs.toDataURL('image/jpeg', 0.75).split(',')[1];
  } catch { return null; }
}

function hintToBbox(hint: string, vw: number, vh: number): [number, number, number, number] {
  const bw = vw * 0.28;
  const bh = vh * 0.28;
  const map: Record<string, [number, number]> = {
    'top-left':      [vw * 0.05, vh * 0.05],
    'top-center':    [(vw - bw) / 2, vh * 0.05],
    'top-right':     [vw * 0.95 - bw, vh * 0.05],
    'center-left':   [vw * 0.05, (vh - bh) / 2],
    'center':        [(vw - bw) / 2, (vh - bh) / 2],
    'center-right':  [vw * 0.95 - bw, (vh - bh) / 2],
    'bottom-left':   [vw * 0.05, vh * 0.95 - bh],
    'bottom-center': [(vw - bw) / 2, vh * 0.95 - bh],
    'bottom-right':  [vw * 0.95 - bw, vh * 0.95 - bh],
  };
  const [bx, by] = map[hint] ?? [(vw - bw) / 2, (vh - bh) / 2];
  return [bx, by, bw, bh];
}

// ─── Claude Vision ────────────────────────────────────────────────────────────────
async function askClaude(frameB64: string, targets: RegisteredObject[]): Promise<ClaudeResult[]> {
  if (!targets.length) return [];

  const list = targets.map((o, i) => `${i + 1}. "${o.object_name}"`).join('\n');
  const prompt = `You are a strict object detection system. Examine this camera frame carefully.

Find these specific objects:
${list}

Respond ONLY with a raw JSON array — absolutely no markdown, no explanation, just JSON:
[
  {"index":1,"found":true,"confidence":"high","location_hint":"bottom-center"},
  {"index":2,"found":false,"confidence":"high","location_hint":""}
]

Rules:
- confidence: "high" = clearly visible, "medium" = partially visible, "low" = uncertain
- Only set found=true if confidence is "high" or "medium" — be strict, avoid false positives
- location_hint must be one of: top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: frameB64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
    const data = await res.json();
    const text = (data.content ?? []).find((c: {type:string}) => c.type === 'text')?.text ?? '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed: Array<{ index: number; found: boolean; confidence: string; location_hint: string }> = JSON.parse(clean);

    return parsed.map(r => ({
      objectId:      targets[r.index - 1]?.id ?? '',
      objectName:    targets[r.index - 1]?.object_name ?? '',
      found:         r.found && (r.confidence === 'high' || r.confidence === 'medium'),
      confidence:    r.confidence as 'high' | 'medium' | 'low',
      location_hint: r.location_hint,
    })).filter(r => r.objectId);
  } catch { return []; }
}

// ─── Component ────────────────────────────────────────────────────────────────────
export function LiveCamera() {
  const { user } = useAuth();

  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const modelRef       = useRef<cocoSsd.ObjectDetection | null>(null);
  const rafRef         = useRef<number>(0);
  const isRunning      = useRef(false);
  const lastAlertRef   = useRef<Record<string, number>>({});
  const frameCountRef  = useRef<Record<string, number>>({});
  const lastScanRef    = useRef<number>(0);
  const isScanningRef  = useRef(false);
  const claudeResultsRef = useRef<Detection[]>([]);

  const registeredObjectsRef = useRef<RegisteredObject[]>([]);
  const selectedRoomRef      = useRef<Room | null>(null);
  const debugModeRef         = useRef(false);

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
  const [claudeActive,  setClaudeActive]  = useState(false);
  const [claudeScans,   setClaudeScans]   = useState(0);

  const fpsFrames = useRef(0);
  const fpsTimer  = useRef(0);

  useEffect(() => { registeredObjectsRef.current = registeredObjects; }, [registeredObjects]);
  useEffect(() => { selectedRoomRef.current = selectedRoom; }, [selectedRoom]);
  useEffect(() => { debugModeRef.current = debugMode; }, [debugMode]);

  // ── Model ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setModelLoading(true);
    (async () => {
      try {
        const m = await cocoSsd.load({ base: 'mobilenet_v2' });
        if (!cancelled) { modelRef.current = m; setModelLoaded(true); setModelLoading(false); }
      } catch {
        if (!cancelled) { setModelError('Failed to load AI model. Please refresh.'); setModelLoading(false); }
      }
    })();
    return () => { cancelled = true; stopCamera(); };
  }, []); // eslint-disable-line

  // ── Data ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from('objects')
      .select('id, object_name, usual_location, last_known_location, image_url')
      .eq('user_id', user.id)
      .then(({ data }) => { if (data) setRegisteredObjects(data as RegisteredObject[]); });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from('rooms').select('id, room_name, floor, image_url')
      .eq('user_id', user.id).order('floor').order('room_name')
      .then(({ data }) => { if (data) setRooms(data as Room[]); });
  }, [user]);

  // ── Auto-start ────────────────────────────────────────────────────────────────
  const autoStartDoneRef = useRef(false);
  useEffect(() => {
    if (!user || !modelLoaded || autoStartDoneRef.current) return;
    supabase.from('user_preferences').select('camera_detection_enabled')
      .eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.camera_detection_enabled && !isRunning.current) {
          autoStartDoneRef.current = true;
          setTimeout(() => startCamera(), 500);
        }
      });
  }, [user, modelLoaded]); // eslint-disable-line

  // ── Speech ────────────────────────────────────────────────────────────────────
  const lastSpoken = useRef('');
  const speak = useCallback((text: string) => {
    if (!voiceEnabled || text === lastSpoken.current) return;
    lastSpoken.current = text;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95; u.pitch = 1;
      window.speechSynthesis.speak(u);
    }
  }, [voiceEnabled]);

  // ── Log ───────────────────────────────────────────────────────────────────────
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

  // ── Claude scan ───────────────────────────────────────────────────────────────
  const runClaudeScan = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || isScanningRef.current) return;

    const objects = registeredObjectsRef.current;
    const nonCoco = objects.filter(o => !isCocoDetectable(o.object_name));
    if (!nonCoco.length) return;

    const frame = captureFrame(video);
    if (!frame) return;

    isScanningRef.current = true;
    setClaudeActive(true);

    const results = await askClaude(frame, nonCoco);

    const canvas = canvasRef.current;
    const vw = canvas?.width  || 640;
    const vh = canvas?.height || 480;
    const currentLocation = selectedRoomRef.current
      ? `${selectedRoomRef.current.room_name} (${selectedRoomRef.current.floor})`
      : 'Unknown Room';

    const newDetections: Detection[] = [];

    for (const r of results) {
      if (!r.found) continue;
      const obj = nonCoco.find(o => o.id === r.objectId);
      if (!obj) continue;

      const usual     = (obj.usual_location || '').toLowerCase().trim();
      const isUnusual = usual ? !currentLocation.toLowerCase().includes(usual) : false;
      const bbox      = hintToBbox(r.location_hint ?? 'center', vw, vh);
      const score     = r.confidence === 'high' ? 0.93 : 0.76;

      newDetections.push({
        cocoClass: obj.object_name, displayName: obj.object_name,
        score, bbox, isRegistered: true, isUnusual,
        usualLocation: obj.usual_location, registeredObjId: obj.id,
        source: 'claude',
      });

      if (isUnusual) {
        const key = obj.id + '_alert';
        const now = Date.now();
        if (now - (lastAlertRef.current[key] ?? 0) > ALERT_COOLDOWN) {
          lastAlertRef.current[key] = now;
          showNotification('Unusual Activity Detected', `"${obj.object_name}" found in unexpected location! Usually: ${obj.usual_location}`, 'warning', true);
          speak(`Alert! ${obj.object_name} found in unusual location. It should be at ${obj.usual_location}.`);
          setUnusualAlerts(prev => [`${obj.object_name} — found here (usual: ${obj.usual_location})`, ...prev].slice(0, 10));
        }
      } else {
        const key = obj.id + '_found';
        const now = Date.now();
        if (now - (lastAlertRef.current[key] ?? 0) > ALERT_COOLDOWN) {
          lastAlertRef.current[key] = now;
          speak(`Found your ${obj.object_name}.`);
        }
      }
      logDetection(obj, score, isUnusual, currentLocation);
    }

    claudeResultsRef.current = newDetections;
    isScanningRef.current = false;
    setClaudeActive(false);
    setClaudeScans(n => n + 1);
  }, [speak, logDetection]);

  // ── Detection loop ────────────────────────────────────────────────────────────
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
      canvas.width = vw; canvas.height = vh;
    }

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, vw, vh);

    fpsFrames.current++;
    const now = performance.now();
    if (now - fpsTimer.current >= 1000) {
      setFps(fpsFrames.current);
      fpsFrames.current = 0;
      fpsTimer.current  = now;
    }

    if (Date.now() - lastScanRef.current > CLAUDE_SCAN_INTERVAL) {
      lastScanRef.current = Date.now();
      runClaudeScan();
    }

    let preds: cocoSsd.DetectedObject[] = [];
    try { preds = await model.detect(video); } catch {
      if (isRunning.current) rafRef.current = requestAnimationFrame(runDetection);
      return;
    }

    const currentLocation = selectedRoomRef.current
      ? `${selectedRoomRef.current.room_name} (${selectedRoomRef.current.floor})`
      : 'Unknown Room';

    const cocoDetections: Detection[] = [];
    const seenClasses = new Set<string>();

    for (const pred of preds) {
      if (pred.score < MIN_CONFIDENCE) continue;
      if (pred.score < (CLASS_MIN_CONFIDENCE[pred.class] ?? 0)) continue;

      const [bx, by, bw, bh] = pred.bbox;
      seenClasses.add(pred.class);
      frameCountRef.current[pred.class] = (frameCountRef.current[pred.class] ?? 0) + 1;
      if (frameCountRef.current[pred.class] < STABILITY_FRAMES) continue;

      const matched      = findMatch(pred.class, registeredObjectsRef.current);
      const isRegistered = !!matched;
      const usual        = isRegistered ? (matched!.usual_location || '').toLowerCase().trim() : '';
      const isUnusual    = isRegistered && usual ? !currentLocation.toLowerCase().includes(usual) : false;
      const displayName  = matched?.object_name ?? pred.class;

      if (matched) {
        if (isUnusual) {
          const key = matched.id + '_alert';
          const alertNow = Date.now();
          if (alertNow - (lastAlertRef.current[key] ?? 0) > ALERT_COOLDOWN) {
            lastAlertRef.current[key] = alertNow;
            showNotification('Unusual Activity Detected', `"${matched.object_name}" found in unexpected location! Usually: ${matched.usual_location}`, 'warning', true);
            speak(`Alert! ${matched.object_name} found in unusual location. It should be at ${matched.usual_location}.`);
            setUnusualAlerts(prev => [`${matched.object_name} — found here (usual: ${matched.usual_location})`, ...prev].slice(0, 10));
          }
        }
        logDetection(matched, pred.score, isUnusual, currentLocation);
      }

      const conf = Math.round(pred.score * 100);
      // ── Box color rules ──
      // RED   = your registered object in WRONG location
      // GREEN = your registered object in CORRECT location
      // BLUE  = detected but NOT your registered object
      const color    = isRegistered ? (isUnusual ? '#EF4444' : '#10B981') : '#3B82F6';
      const label    = `${displayName.toUpperCase()}  ${conf}%`;
      const subLabel = isRegistered
        ? (isUnusual ? `⚠ Wrong! Should be: ${matched!.usual_location}` : '✓ Correct location')
        : (debugModeRef.current ? `[${pred.class}]` : 'Not in your list');

      drawBox(ctx, bx, by, bw, bh, color, label, subLabel, false);

      cocoDetections.push({
        cocoClass: pred.class, displayName, score: pred.score,
        bbox: pred.bbox as [number, number, number, number],
        isRegistered, isUnusual, usualLocation: matched?.usual_location,
        registeredObjId: matched?.id,
        source: 'coco',
      });
    }

    for (const cls of Object.keys(frameCountRef.current)) {
      if (!seenClasses.has(cls)) {
        frameCountRef.current[cls] = Math.max(0, (frameCountRef.current[cls] ?? 0) - DECAY_ON_MISS);
      }
    }

    // Draw Claude detections (dashed) — same color rules
    for (const cd of claudeResultsRef.current) {
      const [bx, by, bw, bh] = cd.bbox;
      const color    = cd.isUnusual ? '#EF4444' : '#10B981';
      const conf     = Math.round(cd.score * 100);
      const label    = `${cd.displayName.toUpperCase()}  ${conf}% ✦`;
      const subLabel = cd.isUnusual
        ? `⚠ Wrong! Should be: ${cd.usualLocation}`
        : '✓ Correct location (AI)';
      drawBox(ctx, bx, by, bw, bh, color, label, subLabel, true);
    }

    // Merge — deduplicate (COCO takes priority over Claude for same object)
    const cocoObjIds = new Set(cocoDetections.map(d => d.registeredObjId).filter(Boolean));
    const filteredClaude = claudeResultsRef.current.filter(d => !cocoObjIds.has(d.registeredObjId));
    setDetections([...cocoDetections, ...filteredClaude]);

    if (isRunning.current) rafRef.current = requestAnimationFrame(runDetection);
  }, [runClaudeScan, speak, logDetection]);

  // ── Start / Stop ──────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = ms;
      if (videoRef.current) { videoRef.current.srcObject = ms; await videoRef.current.play(); }
      isRunning.current        = true;
      fpsFrames.current        = 0;
      fpsTimer.current         = performance.now();
      claudeResultsRef.current = [];
      setIsActive(true);
      speak('Camera started. Scanning for objects.');
      rafRef.current = requestAnimationFrame(runDetection);
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      setCameraError(
        name === 'NotAllowedError' ? 'Camera permission denied. Allow camera access in your browser settings.'
        : name === 'NotFoundError' ? 'No camera found. Please connect a camera and try again.'
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
    frameCountRef.current    = {};
    claudeResultsRef.current = [];
    setIsActive(false);
    setDetections([]);
    setFps(0);
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    if (isActive) { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(runDetection); }
  }, [registeredObjects, runDetection, isActive]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const registeredDetections   = detections.filter(d => d.isRegistered);
  const unregisteredDetections = detections.filter(d => !d.isRegistered);
  const unusualDetections      = registeredDetections.filter(d => d.isUnusual);
  const normalDetections       = registeredDetections.filter(d => !d.isUnusual);
  const claudeDetections       = detections.filter(d => d.source === 'claude');
  const nonCocoObjects         = registeredObjects.filter(o => !isCocoDetectable(o.object_name));

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Live Camera Detection</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          COCO-SSD + Claude AI Vision · <span className="text-red-500 font-medium">Red</span> = wrong location · <span className="text-green-500 font-medium">Green</span> = correct · <span className="text-blue-500 font-medium">Blue</span> = unregistered
        </p>
      </div>

      {/* Banners */}
      {modelLoading && !modelError && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">Loading AI detection model (MobileNet v2)…</p>
        </div>
      )}
      {modelError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1"><p className="text-sm text-red-700 dark:text-red-400">{modelError}</p></div>
          <button onClick={() => window.location.reload()} className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800">
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
            No registered objects. <a href="/dashboard/add-object" className="underline font-semibold">Add objects</a> to start tracking.
          </p>
        </div>
      )}

      {/* Claude AI notice */}
      {nonCocoObjects.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl">
          <Sparkles className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-purple-800 dark:text-purple-300 mb-0.5">
              Claude AI Vision scanning {nonCocoObjects.length} object{nonCocoObjects.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 leading-relaxed">
              {nonCocoObjects.map(o => `"${o.object_name}"`).join(', ')}
            </p>
            <p className="text-xs text-purple-500 mt-1">
              Scans every {CLAUDE_SCAN_INTERVAL / 1000}s · shown as dashed boxes on camera
              {isActive && claudeActive && <span className="ml-2 inline-flex items-center gap-1 text-purple-600"><Loader2 className="w-3 h-3 animate-spin" />Scanning…</span>}
              {isActive && !claudeActive && claudeScans > 0 && <span className="ml-2 opacity-60">· {claudeScans} scan{claudeScans !== 1 ? 's' : ''} done</span>}
            </p>
          </div>
        </div>
      )}

      {/* Live stats */}
      {isActive && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Detected',  value: registeredDetections.length,  icon: Eye,           c: 'blue'  },
            { label: 'Normal',    value: normalDetections.length,       icon: CheckCircle2,  c: 'green' },
            { label: 'Unusual ⚠', value: unusualDetections.length,      icon: AlertTriangle, c: 'red'   },
            { label: 'Other',     value: unregisteredDetections.length, icon: Bug,           c: 'gray'  },
          ].map(({ label, value, icon: Icon, c }) => (
            <div key={label} className={`bg-${c}-50 dark:bg-${c}-900/20 border border-${c}-200 dark:border-${c}-700 rounded-2xl p-3 flex items-center gap-3`}>
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
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Which room is this camera in?</h3>
        </div>
        {rooms.length === 0 ? (
          <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              No rooms yet. <a href="/dashboard/rooms" className="underline font-semibold">Add rooms</a> to enable location-based detection.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {rooms.map(room => (
              <button key={room.id} onClick={() => setSelectedRoom(r => r?.id === room.id ? null : room)}
                className={`relative rounded-2xl overflow-hidden border-2 transition-all text-left ${
                  selectedRoom?.id === room.id
                    ? 'border-blue-500 ring-2 ring-blue-500/30 scale-[1.02]'
                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                }`}>
                <div className="h-20 bg-gray-100 dark:bg-gray-700 relative">
                  {room.image_url
                    ? <img src={room.image_url} alt={room.room_name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">🏠</div>}
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={isActive ? stopCamera : startCamera} disabled={!modelLoaded}
              className={`px-5 py-2.5 rounded-2xl font-semibold flex items-center gap-2 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-green-500/30'
              }`}>
              {isActive ? <><CameraOff className="w-4 h-4" />Stop</> : <><Camera className="w-4 h-4" />Start Camera</>}
            </button>
            <button onClick={() => setShowSettings(v => !v)}
              className={`p-2.5 rounded-xl transition-colors ${showSettings ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
              <Settings2 className="w-4 h-4" />
            </button>
            <button onClick={() => setVoiceEnabled(v => !v)}
              className={`p-2.5 rounded-xl transition-colors ${voiceEnabled ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button onClick={() => setDebugMode(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-colors ${debugMode ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
              <Bug className="w-3.5 h-3.5" />Debug
            </button>
          </div>
          {isActive && (
            <div className="flex items-center gap-3">
              {debugMode && <span className="text-xs text-gray-400 font-mono">{fps} fps</span>}
              {claudeActive && <span className="flex items-center gap-1 text-xs text-purple-500"><Sparkles className="w-3.5 h-3.5 animate-pulse" />AI scan…</span>}
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-red-600 dark:text-red-400">LIVE</span>
              </div>
            </div>
          )}
        </div>

        {showSettings && (
          <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-2xl">
            <button onClick={() => setNightMode(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-colors ${nightMode ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'}`}>
              <Sun className="w-3.5 h-3.5" />Night Mode
            </button>
            <div className="flex items-center gap-2">
              <Sun className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500 w-16">Brightness</span>
              <input type="range" min={50} max={250} value={brightness} onChange={e => setBrightness(Number(e.target.value))} className="w-24 accent-yellow-400" />
              <span className="text-xs text-gray-400 w-8">{brightness}%</span>
            </div>
            <div className="flex items-center gap-2">
              <ZoomIn className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500 w-8">Zoom</span>
              <input type="range" min={1} max={3} step={0.1} value={zoomLevel} onChange={e => setZoomLevel(Number(e.target.value))} className="w-24 accent-blue-400" />
              <span className="text-xs text-gray-400 w-8">{zoomLevel.toFixed(1)}×</span>
            </div>
          </div>
        )}

        <div className="relative bg-black rounded-2xl overflow-hidden" style={{ minHeight: isActive ? 0 : 240 }}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full block"
            style={{
              display: isActive ? 'block' : 'none',
              transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
              transformOrigin: 'center center',
              filter: `brightness(${brightness}%)${nightMode ? ' contrast(140%) saturate(60%) hue-rotate(200deg)' : ''}`,
            }} />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"
            style={{ display: isActive ? 'block' : 'none', pointerEvents: 'none' }} />
          {!isActive && (
            <div className="aspect-video flex items-center justify-center">
              <div className="text-center">
                {modelLoading && !modelError
                  ? <Loader2 className="w-14 h-14 text-gray-500 mx-auto mb-3 animate-spin" />
                  : <Camera className="w-14 h-14 text-gray-500 mx-auto mb-3" />}
                <p className="text-gray-400 text-sm">{modelLoading && !modelError ? 'Loading AI model…' : 'Press Start Camera to begin'}</p>
                {modelLoaded && (
                  <p className="text-xs text-gray-500 mt-1">
                    Monitoring {registeredObjects.length} object{registeredObjects.length !== 1 ? 's' : ''}
                    {nonCocoObjects.length > 0 && ` · ${nonCocoObjects.length} via Claude Vision`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {isActive && (
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
            {[
              { color: 'bg-green-500', dash: false, label: 'Your object — correct location' },
              { color: 'bg-red-500',   dash: false, label: 'Your object — wrong location ⚠' },
              { color: 'bg-blue-500',  dash: false, label: 'Detected — not in your list' },
              { color: 'bg-green-500', dash: true,  label: 'AI Vision — correct ✦' },
              { color: 'bg-red-500',   dash: true,  label: 'AI Vision — wrong location ✦' },
            ].map(({ color, dash, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <span className={`w-4 h-3 rounded-sm ${color} inline-block shrink-0 ${dash ? 'opacity-70 outline outline-dashed outline-1 outline-offset-1 outline-current' : ''}`} />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ⚠ Unusual — shown prominently with red styling */}
      {unusualDetections.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-700 rounded-3xl p-5">
          <h3 className="text-base font-bold text-red-900 dark:text-red-300 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5" />
            ⚠ {unusualDetections.length} Object{unusualDetections.length !== 1 ? 's' : ''} in Wrong Location
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {unusualDetections.map((d, i) => (
              <div key={i} className="rounded-2xl p-3 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <p className="text-sm font-bold text-red-800 dark:text-red-300 capitalize truncate">{d.displayName}</p>
                  {d.source === 'claude' && <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0 ml-auto" />}
                </div>
                <p className="text-xs text-red-500">{Math.round(d.score * 100)}% confidence</p>
                {d.usualLocation && (
                  <p className="text-xs text-red-700 dark:text-red-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />Should be: <strong className="ml-0.5">{d.usualLocation}</strong>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ✓ Normal detections */}
      {normalDetections.length > 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Objects in Correct Location ({normalDetections.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {normalDetections.map((d, i) => (
              <div key={i} className="rounded-2xl p-3 border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <p className="text-sm font-bold text-green-800 dark:text-green-300 capitalize truncate">{d.displayName}</p>
                  {d.source === 'claude' && <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0 ml-auto" />}
                </div>
                <p className="text-xs text-gray-500">{Math.round(d.score * 100)}% confidence</p>
                {d.usualLocation && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />{d.usualLocation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claude-specific panel */}
      {claudeDetections.length > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-900 rounded-3xl p-5">
          <h3 className="text-base font-bold text-purple-900 dark:text-purple-300 flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5" />Found by Claude AI Vision ({claudeDetections.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {claudeDetections.map((d, i) => (
              <div key={i} className={`rounded-2xl p-3 border ${d.isUnusual ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' : 'bg-white dark:bg-purple-900/20 border-purple-200 dark:border-purple-700'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {d.isUnusual
                    ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    : <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                  <p className="text-sm font-semibold capitalize text-gray-800 dark:text-gray-200 truncate">{d.displayName}</p>
                </div>
                <p className="text-xs text-gray-400">{Math.round(d.score * 100)}% confidence</p>
                {d.isUnusual && d.usualLocation && (
                  <p className="text-xs text-red-500 mt-1">⚠ Should be: {d.usualLocation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unregistered */}
      {unregisteredDetections.length > 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-5 border border-blue-200 dark:border-blue-800 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-blue-500" />
            Other Objects Detected ({unregisteredDetections.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {unregisteredDetections.map((d, i) => (
              <div key={i} className="rounded-2xl p-3 border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold capitalize truncate text-blue-800 dark:text-blue-300">{d.cocoClass}</p>
                  <p className="text-xs text-gray-400">{Math.round(d.score * 100)}% confidence</p>
                </div>
                <a href="/dashboard/add-object" className="text-[10px] shrink-0 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-lg hover:bg-blue-200 transition-colors">
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
              <Clock className="w-5 h-5" />Unusual Activity Log
            </h3>
            <button onClick={() => setUnusualAlerts([])} className="text-xs text-red-400 hover:text-red-600">Clear</button>
          </div>
          <div className="space-y-2">
            {unusualAlerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />{a}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monitoring grid */}
      {registeredObjects.length > 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-500" />
            Monitoring {registeredObjects.length} Object{registeredObjects.length !== 1 ? 's' : ''}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {registeredObjects.map(obj => {
              const detected = detections.find(d =>
                d.registeredObjId === obj.id ||
                d.displayName.toLowerCase() === obj.object_name.toLowerCase(),
              );
              const needsClaude = !isCocoDetectable(obj.object_name);
              return (
                <div key={obj.id}
                  className={`flex items-center gap-2 rounded-xl px-2.5 py-2 transition-all border ${
                    detected
                      ? detected.isUnusual
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                        : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-transparent'
                  }`}>
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
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {detected && !detected.isUnusual && <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">● visible</span>}
                      {detected && detected.isUnusual && <span className="text-[10px] text-red-500 font-bold">⚠ wrong place</span>}
                      {needsClaude && <span className="text-[10px] text-purple-500 flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />AI</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 space-y-2">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          🔒 <strong>Privacy:</strong> Video never leaves your device. Only a compressed snapshot is sent to Claude AI every {CLAUDE_SCAN_INTERVAL / 1000}s for objects outside COCO's 80 classes.
        </p>
        <p className="text-sm text-blue-800 dark:text-blue-300">
          🟥 <strong>Red</strong> = your object detected in wrong room · 🟩 <strong>Green</strong> = correct location · 🟦 <strong>Blue</strong> = detected but not your object · Dashed = Claude AI Vision.
        </p>
        <p className="text-sm text-blue-800 dark:text-blue-300">
          ✦ Objects like rings, watches, pens, airpods, purses, calculators are scanned by Claude Vision every {CLAUDE_SCAN_INTERVAL / 1000}s and shown with dashed borders.
        </p>
        {debugMode && (
          <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">
            Debug · min_conf: {MIN_CONFIDENCE} · stability: {STABILITY_FRAMES}f · alert_cooldown: {ALERT_COOLDOWN/1000}s · claude_interval: {CLAUDE_SCAN_INTERVAL/1000}s · non-COCO: {nonCocoObjects.length}
          </p>
        )}
      </div>
    </div>
  );
}