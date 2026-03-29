import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const LANGUAGES = [
  // ── Indian languages ──────────────────────────────────────
  { code: 'ml-IN', label: 'Malayalam',  flag: '🇮🇳', region: 'India' },
  { code: 'hi-IN', label: 'Hindi',      flag: '🇮🇳', region: 'India' },
  { code: 'ta-IN', label: 'Tamil',      flag: '🇮🇳', region: 'India' },
  { code: 'te-IN', label: 'Telugu',     flag: '🇮🇳', region: 'India' },
  { code: 'kn-IN', label: 'Kannada',    flag: '🇮🇳', region: 'India' },
  { code: 'mr-IN', label: 'Marathi',    flag: '🇮🇳', region: 'India' },
  { code: 'gu-IN', label: 'Gujarati',   flag: '🇮🇳', region: 'India' },
  { code: 'pa-IN', label: 'Punjabi',    flag: '🇮🇳', region: 'India' },
  { code: 'bn-IN', label: 'Bengali',    flag: '🇮🇳', region: 'India' },
  { code: 'or-IN', label: 'Odia',       flag: '🇮🇳', region: 'India' },
  { code: 'as-IN', label: 'Assamese',   flag: '🇮🇳', region: 'India' },
  { code: 'ur-IN', label: 'Urdu',       flag: '🇮🇳', region: 'India' },
  { code: 'ne-IN', label: 'Nepali',     flag: '🇮🇳', region: 'India' },
  { code: 'si-LK', label: 'Sinhala',    flag: '🇱🇰', region: 'India' },
  { code: 'en-IN', label: 'English (India)', flag: '🇮🇳', region: 'India' },
  // ── International languages ───────────────────────────────
  { code: 'en-US', label: 'English (US)',  flag: '🇺🇸', region: 'International' },
  { code: 'en-GB', label: 'English (UK)',  flag: '🇬🇧', region: 'International' },
  { code: 'ar-SA', label: 'Arabic',        flag: '🇸🇦', region: 'International' },
  { code: 'zh-CN', label: 'Chinese',       flag: '🇨🇳', region: 'International' },
  { code: 'fr-FR', label: 'French',        flag: '🇫🇷', region: 'International' },
  { code: 'de-DE', label: 'German',        flag: '🇩🇪', region: 'International' },
  { code: 'es-ES', label: 'Spanish',       flag: '🇪🇸', region: 'International' },
  { code: 'pt-BR', label: 'Portuguese',    flag: '🇧🇷', region: 'International' },
  { code: 'ja-JP', label: 'Japanese',      flag: '🇯🇵', region: 'International' },
  { code: 'ko-KR', label: 'Korean',        flag: '🇰🇷', region: 'International' },
  { code: 'ru-RU', label: 'Russian',       flag: '🇷🇺', region: 'International' },
  { code: 'tr-TR', label: 'Turkish',       flag: '🇹🇷', region: 'International' },
  { code: 'it-IT', label: 'Italian',       flag: '🇮🇹', region: 'International' },
  { code: 'id-ID', label: 'Indonesian',    flag: '🇮🇩', region: 'International' },
  { code: 'ms-MY', label: 'Malay',         flag: '🇲🇾', region: 'International' },
];

// Commands in each language: [trigger keywords] → action
// For non-English we use transliterated/common forms that the STT engine returns


// Universal keyword → action mapping (works across languages via STT output)
function detectAction(t: string): string | null {
  const T = t.toLowerCase();
  // WHERE IS / FIND
  if (/where (is|are|did|did i put)|find my|எங்கே|എവിടെ|कहाँ है|ఎక్కడ|ಎಲ್ಲಿ|कुठे आहे|क्या हुआ|где|どこ|어디|nerede/.test(T)) return 'find';
  // CAMERA
  if (/camera|scan|detect|கேமரா|ക്യാമറ|कैमरा|కెమెరా|ಕ್ಯಾಮೆರಾ|kamera|カメラ|카메라/.test(T)) return 'camera';
  // ADD OBJECT / REGISTER
  if (/add object|register|add item|new object|വസ്തു ചേർ|वस्तु जोड़|объект добав|추가|追加|ekle|aggiungi/.test(T)) return 'add';
  // SHOW OBJECTS / MY OBJECTS
  if (/my objects|show objects|registered|list objects|എന്റെ|மேmories|मेरी वस्तुएं|мои объекты|私のもの|내 물건/.test(T)) return 'objects';
  // DASHBOARD / HOME
  if (/dashboard|home|overview|главная|ホーム|홈|başlangıç|inicio/.test(T)) return 'dashboard';
  // ALERTS / HISTORY
  if (/alert|history|log|alerte|تنبيه|uyarı|警告|경고|अलर्ट/.test(T)) return 'alerts';
  // SETTINGS
  if (/setting|config|preference|configuración|설정|設定|einstellung|impostazioni/.test(T)) return 'settings';
  // ROOMS
  if (/room|rooms|കമര|कमरे|odalar|salle|zimmer|stanza|部屋|방/.test(T)) return 'rooms';
  // PHONE
  if (/phone|find phone|recover|ഫോൺ|फोन|телефон|電話|전화/.test(T)) return 'phone';
  // HELP
  if (/help|commands|what can|సహాయం|സഹായം|मदद|помощь|助けて|도움/.test(T)) return 'help';
  return null;
}

// Extract object name from "where is my X" style queries
function extractObjectName(t: string): string {
  return t
    .replace(/where (is|are|did|did i put) (my|the)?/gi, '')
    .replace(/find (my|the)?/gi, '')
    .replace(/എവിടെ|कहाँ है|ఎక్కడ|ಎಲ್ಲಿ|donde está/gi, '')
    .trim();
}

// Responses per language (action → template function)
const RESPONSES: Record<string, Record<string, (name?: string, loc?: string, time?: string) => string>> = {
  'ml-IN': {
    found:    (n, l, t) => `നിങ്ങളുടെ ${n} ${l}-ൽ കണ്ടെത്തി${t ? `, ${t}` : ''}`,
    notFound: (n)       => `${n} ഇതുവരെ കണ്ടെത്തിയിട്ടില്ല`,
    noObject: (n)       => `${n} രജിസ്റ്റർ ചെയ്ത വസ്തുക്കളിൽ കണ്ടില്ല`,
    camera:   ()        => 'ക്യാമറ തുറക്കുന്നു',
    add:      ()        => 'വസ്തു ചേർക്കുന്ന ഫോം തുറക്കുന്നു',
    objects:  ()        => 'നിങ്ങളുടെ വസ്തുക്കൾ കാണിക്കുന്നു',
    dashboard:()        => 'ഡാഷ്ബോർഡ് തുറക്കുന്നു',
    alerts:   ()        => 'അലേർട്ടുകൾ തുറക്കുന്നു',
    settings: ()        => 'ക്രമീകരണങ്ങൾ തുറക്കുന്നു',
    rooms:    ()        => 'മുറികൾ കാണിക്കുന്നു',
    phone:    ()        => 'ഫോൺ റിക്കവറി തുറക്കുന്നു',
    help:     ()        => 'ക്യാമറ, വസ്തു ചേർക്കുക, വസ്തുക്കൾ, ഡാഷ്ബോർഡ് എന്നിവ ആജ്ഞകളാണ്',
    activated:()        => 'ശബ്ദ സഹായി സജീവമാണ്',
    deactivated:()      => 'ശബ്ദ സഹായി നിർത്തി',
    unknown:  ()        => 'ക്ഷമിക്കണം, ആ ആജ്ഞ മനസ്സിലായില്ല',
  },
  'hi-IN': {
    found:    (n, l, t) => `आपका ${n} ${l} में पाया गया${t ? `, ${t}` : ''}`,
    notFound: (n)       => `${n} अभी तक नहीं मिला`,
    noObject: (n)       => `${n} आपके पंजीकृत वस्तुओं में नहीं मिला`,
    camera:   ()        => 'कैमरा खोल रहे हैं',
    add:      ()        => 'वस्तु जोड़ने का फ़ॉर्म खुल रहा है',
    objects:  ()        => 'आपकी वस्तुएं दिखा रहे हैं',
    dashboard:()        => 'डैशबोर्ड खोल रहे हैं',
    alerts:   ()        => 'अलर्ट खोल रहे हैं',
    settings: ()        => 'सेटिंग खोल रहे हैं',
    rooms:    ()        => 'कमरे दिखा रहे हैं',
    phone:    ()        => 'फोन रिकवरी खोल रहे हैं',
    help:     ()        => 'कैमरा, वस्तु जोड़ें, मेरी वस्तुएं, डैशबोर्ड — ये आदेश हैं',
    activated:()        => 'वॉइस असिस्टेंट चालू है',
    deactivated:()      => 'वॉइस असिस्टेंट बंद है',
    unknown:  ()        => 'माफ़ करें, यह आदेश समझ नहीं आया',
  },
  'ta-IN': {
    found:    (n, l, t) => `உங்கள் ${n} ${l} இல் காணப்பட்டது${t ? `, ${t}` : ''}`,
    notFound: (n)       => `${n} இன்னும் கண்டுபிடிக்கவில்லை`,
    noObject: (n)       => `${n} பதிவு செய்யப்பட்ட பொருட்களில் இல்லை`,
    camera:   ()        => 'கேமரா திறக்கிறது',
    add:      ()        => 'பொருள் சேர்க்கும் படிவம் திறக்கிறது',
    objects:  ()        => 'உங்கள் பொருட்கள் காண்பிக்கப்படுகின்றன',
    dashboard:()        => 'டாஷ்போர்டு திறக்கிறது',
    alerts:   ()        => 'எச்சரிக்கைகள் திறக்கின்றன',
    settings: ()        => 'அமைப்புகள் திறக்கின்றன',
    rooms:    ()        => 'அறைகள் காண்பிக்கப்படுகின்றன',
    phone:    ()        => 'தொலைபேசி மீட்பு திறக்கிறது',
    help:     ()        => 'கேமரா, பொருள் சேர், என் பொருட்கள் — கட்டளைகள்',
    activated:()        => 'குரல் உதவியாளர் இயக்கத்தில் உள்ளது',
    deactivated:()      => 'குரல் உதவியாளர் நிறுத்தப்பட்டது',
    unknown:  ()        => 'மன்னிக்கவும், அந்த கட்டளை புரியவில்லை',
  },
  'en-US': {
    found:    (n, l, t) => `Your ${n} was last seen at ${l}${t ? ` on ${t}` : ''}`,
    notFound: (n)       => `Your ${n} has not been detected yet`,
    noObject: (n)       => `I couldn't find ${n} in your registered objects`,
    camera:   ()        => 'Opening camera detection',
    add:      ()        => 'Opening add object form',
    objects:  ()        => 'Showing your registered objects',
    dashboard:()        => 'Opening dashboard',
    alerts:   ()        => 'Opening alerts and history',
    settings: ()        => 'Opening settings',
    rooms:    ()        => 'Showing your rooms',
    phone:    ()        => 'Opening phone recovery',
    help:     ()        => 'Commands: camera, add object, my objects, dashboard, alerts, settings, rooms',
    activated:()        => 'Voice assistant activated',
    deactivated:()      => 'Voice assistant deactivated',
    unknown:  ()        => 'Sorry, I did not understand that command',
  },
};

// Fallback to English for unlisted languages
function getResponse(lang: string, key: string, a?: string, b?: string, c?: string): string {
  const r = RESPONSES[lang] ?? RESPONSES['en-US'];
  const fn = r[key] ?? RESPONSES['en-US'][key];
  return fn ? fn(a, b, c) : '';
}

export function useVoiceAssistant(langCode = 'en-IN') {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [currentLang, setCurrentLang] = useState(langCode);
  const [transcript, setTranscript] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = currentLang;
    u.rate = 0.92;
    u.pitch = 1;

    // Pick a voice matching the language if available
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang === currentLang)
      ?? voices.find(v => v.lang.startsWith(currentLang.split('-')[0]));
    if (match) u.voice = match;

    window.speechSynthesis.speak(u);
  }, [currentLang]);

  const handleCommand = useCallback(async (t: string) => {
    setTranscript(t);
    const action = detectAction(t);

    if (!action) {
      const msg = getResponse(currentLang, 'unknown');
      setStatusMsg(msg); speak(msg); return;
    }

    if (action === 'find') {
      const name = extractObjectName(t);
      if (!name) return;
      const { data } = await supabase
        .from('objects')
        .select('object_name, last_known_location, last_detected_time')
        .eq('user_id', user?.id)
        .ilike('object_name', `%${name}%`)
        .maybeSingle();

      if (data) {
        const msg = data.last_known_location
          ? getResponse(currentLang, 'found', data.object_name, data.last_known_location,
              data.last_detected_time ? new Date(data.last_detected_time).toLocaleString() : undefined)
          : getResponse(currentLang, 'notFound', data.object_name);
        setStatusMsg(msg); speak(msg);
      } else {
        const msg = getResponse(currentLang, 'noObject', name);
        setStatusMsg(msg); speak(msg);
      }
      return;
    }

    const routes: Record<string, string> = {
      camera: '/dashboard/camera',
      add: '/dashboard/add-object',
      objects: '/dashboard/objects',
      dashboard: '/dashboard',
      alerts: '/dashboard/alerts',
      settings: '/dashboard/settings',
      rooms: '/dashboard/rooms',
      phone: '/dashboard/phone-recovery',
    };

    if (action === 'help') {
      const msg = getResponse(currentLang, 'help');
      setStatusMsg(msg); speak(msg); return;
    }

    if (routes[action]) {
      const msg = getResponse(currentLang, action);
      setStatusMsg(msg); speak(msg);
      setTimeout(() => navigate(routes[action]), 800);
    }
  }, [currentLang, user, navigate, speak]);

  // Build/rebuild recognition whenever lang changes
  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
      ?? (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition;

    if (!SpeechRecognitionCtor) return;

    // Stop existing
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }

    const r = new SpeechRecognitionCtor();
    r.continuous = true;
    r.interimResults = false;
    r.lang = currentLang;

    r.onresult = (event: SpeechRecognitionEvent) => {
      const t = event.results[event.results.length - 1][0].transcript;
      handleCommand(t);
    };

    r.onerror = () => { setIsListening(false); isListeningRef.current = false; };

    r.onend = () => {
      // Auto-restart if we're supposed to be listening
      if (isListeningRef.current) {
        try { r.start(); } catch { /* already started */ }
      }
    };

    recognitionRef.current = r;

    // If we were listening, restart with new lang
    if (isListeningRef.current) {
      try { r.start(); } catch { /* ignore */ }
    }
  }, [currentLang, handleCommand]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListeningRef.current) return;
    isListeningRef.current = true;
    setIsListening(true);
    setTranscript('');
    setStatusMsg('');
    try {
      recognitionRef.current.start();
      const msg = getResponse(currentLang, 'activated');
      setStatusMsg(msg); speak(msg);
    } catch {
      setIsListening(false); isListeningRef.current = false;
    }
  }, [currentLang, speak]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    const msg = getResponse(currentLang, 'deactivated');
    setStatusMsg(msg); speak(msg);
  }, [currentLang, speak]);

  const switchLanguage = useCallback((code: string) => {
    const wasListening = isListeningRef.current;
    if (wasListening) {
      isListeningRef.current = false;
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    }
    setCurrentLang(code);
    setTranscript('');
    setStatusMsg('');
    if (wasListening) {
      // Will restart via useEffect after lang change
      setTimeout(() => {
        isListeningRef.current = true;
        setIsListening(true);
        try { recognitionRef.current?.start(); } catch { /* ignore */ }
      }, 300);
    }
  }, []);

  return { isListening, startListening, stopListening, switchLanguage, currentLang, transcript, statusMsg };
}
