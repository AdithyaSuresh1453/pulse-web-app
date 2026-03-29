import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LANGUAGES } from '../hooks/useVoiceAssistant';

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
  interface SpeechRecognitionInstance extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEventInstance) => void) | null;
    onend: (() => void) | null;
  }
  interface SpeechRecognitionResultEvent extends Event {
    results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionErrorEventInstance extends Event {
    error: string;
    message: string;
  }
}

interface VoiceLockProps {
  mode: 'register' | 'verify';
  onSuccess: () => void;
  onCancel: () => void;
}

const INDIAN_LANGS  = LANGUAGES.filter(l => l.region === 'India');
const INTL_LANGS    = LANGUAGES.filter(l => l.region === 'International');

export function VoiceLock({ mode, onSuccess, onCancel }: VoiceLockProps) {
  const { registerVoicePassphrase, verifyVoicePassphrase } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const currentLangInfo = LANGUAGES.find(l => l.code === selectedLang) ?? LANGUAGES[14];

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = selectedLang;
    u.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang === selectedLang)
      ?? voices.find(v => v.lang.startsWith(selectedLang.split('-')[0]));
    if (match) u.voice = match;
    window.speechSynthesis.speak(u);
  };

  // Rebuild recognition when lang changes
  useEffect(() => {
    const Ctor = window.webkitSpeechRecognition ?? window.SpeechRecognition;
    if (!Ctor) return;

    const r = new Ctor();
    r.continuous = false;
    r.interimResults = false;
    r.lang = selectedLang;

    r.onresult = (event: SpeechRecognitionResultEvent) => {
      const speechResult = event.results[0][0].transcript;
      const confidence = event.results[0][0].confidence;
      setTranscript(speechResult);
      setIsListening(false);

      if (confidence < 0.6) {
        setError('Low confidence. Please speak clearly in a quiet environment.');
        speak('Low confidence. Please try again.');
        return;
      }

      if (mode === 'register') handleRegister(speechResult);
      else handleVerify(speechResult);
    };

    r.onerror = (event: SpeechRecognitionErrorEventInstance) => {
      setIsListening(false);
      const msgs: Record<string, string> = {
        'not-allowed': 'Microphone permission denied. Please allow microphone access.',
        'no-speech': 'No speech detected. Please try again.',
        'network': 'Network error. Please check your connection.',
        'aborted': 'Listening was stopped.',
      };
      setError(msgs[event.error] ?? `Error: ${event.error}`);
    };

    r.onend = () => setIsListening(false);

    recognitionRef.current = r;
  }, [selectedLang, mode]);

  const handleRegister = async (_spokenText: string) => {
    if (!passphrase.trim()) { setError('Please enter a passphrase first'); return; }
    const { error } = await registerVoicePassphrase(passphrase);
    if (error) {
      setError(error.message);
      speak('Failed to register passphrase');
    } else {
      speak('Voice passphrase registered successfully');
      setTimeout(onSuccess, 1500);
    }
  };

  const handleVerify = async (spokenText: string) => {
    const { success } = await verifyVoicePassphrase(spokenText, spokenText);
    if (success) {
      speak('Voice authenticated successfully');
      setTimeout(onSuccess, 1500);
    } else {
      setError('Voice authentication failed. Please try again.');
      speak('Authentication failed. Please try again.');
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) { setError('Speech recognition not supported in this browser.'); return; }
    setError(''); setTranscript(''); setIsListening(true);
    speak(mode === 'register' ? 'Please speak your passphrase clearly' : 'Please speak your passphrase to unlock');
    setTimeout(() => {
      try { recognitionRef.current?.start(); }
      catch { setError('Failed to start. Please try again.'); setIsListening(false); }
    }, 800); // wait for TTS to finish
  };

  const stopListening = () => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    setIsListening(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-md w-full">

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {mode === 'register' ? 'Register Voice Lock' : 'Voice Authentication'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {mode === 'register'
              ? 'Set up your voice passphrase for secure authentication'
              : 'Speak your passphrase to authenticate'}
          </p>
        </div>

        {/* Language picker */}
        <div className="mb-5 relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-blue-500" /> Language
          </label>
          <button
            type="button"
            onClick={() => setShowLangPicker(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:border-blue-500 focus:outline-none transition-colors"
          >
            <span className="flex items-center gap-2">
              <span>{currentLangInfo.flag}</span>
              <span>{currentLangInfo.label}</span>
            </span>
            <span className="text-gray-400">▾</span>
          </button>

          {showLangPicker && (
            <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden max-h-64 overflow-y-auto">
              <div className="p-2">
                <p className="text-xs font-semibold text-gray-400 uppercase px-2 py-1">🇮🇳 Indian</p>
                {INDIAN_LANGS.map(l => (
                  <button key={l.code} onClick={() => { setSelectedLang(l.code); setShowLangPicker(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-colors ${selectedLang === l.code ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    <span>{l.flag}</span><span>{l.label}</span>
                  </button>
                ))}
                <p className="text-xs font-semibold text-gray-400 uppercase px-2 py-1 mt-2">🌍 International</p>
                {INTL_LANGS.map(l => (
                  <button key={l.code} onClick={() => { setSelectedLang(l.code); setShowLangPicker(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-colors ${selectedLang === l.code ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    <span>{l.flag}</span><span>{l.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Passphrase input (register mode) */}
        {mode === 'register' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Create Your Passphrase
            </label>
            <input
              type="text" value={passphrase} onChange={e => setPassphrase(e.target.value)}
              placeholder="e.g., My secret phrase is secure"
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Choose a phrase that's easy to remember but hard to guess
            </p>
          </div>
        )}

        {/* Mic button */}
        <div className="flex flex-col items-center py-6">
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={mode === 'register' && !passphrase.trim()}
            className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-gradient-to-br from-pink-400 to-pink-600 shadow-lg shadow-pink-500/50 scale-110'
                : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isListening && (
              <>
                <span className="absolute inset-0 rounded-full border-4 border-pink-300 animate-ping" />
                <span className="absolute inset-0 rounded-full border-4 border-pink-400 animate-pulse" />
              </>
            )}
            {isListening
              ? <Mic className="w-12 h-12 text-white relative z-10" />
              : <MicOff className="w-12 h-12 text-white" />
            }
          </button>

          <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
            {isListening ? 'Listening…' : 'Tap to Start'}
          </p>

          {transcript && (
            <div className="mt-4 w-full p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-1">
                <Volume2 className="w-4 h-4" />
                <span className="text-sm font-medium">Detected:</span>
              </div>
              <p className="text-sm text-green-800 dark:text-green-300">{transcript}</p>
            </div>
          )}

          {error && (
            <div className="mt-4 w-full p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        <button onClick={onCancel}
          className="w-full px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >Cancel</button>
      </div>
    </div>
  );
}