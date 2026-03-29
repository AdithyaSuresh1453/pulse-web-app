import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Globe, X, ChevronDown } from 'lucide-react';
import { useVoiceAssistant, LANGUAGES } from '../hooks/useVoiceAssistant';

const INDIAN_LANGS  = LANGUAGES.filter(l => l.region === 'India');
const INTL_LANGS    = LANGUAGES.filter(l => l.region === 'International');

export function VoiceAssistant() {
  const [showPicker, setShowPicker] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const {
    isListening,
    startListening,
    stopListening,
    switchLanguage,
    currentLang,
    transcript,
    statusMsg,
  } = useVoiceAssistant('en-IN');

  const currentLangInfo = LANGUAGES.find(l => l.code === currentLang) ?? LANGUAGES[14];

  // Show status bubble whenever transcript or statusMsg changes
  useEffect(() => {
    if (transcript || statusMsg) {
      setShowStatus(true);
      const t = setTimeout(() => setShowStatus(false), 4000);
      return () => clearTimeout(t);
    }
  }, [transcript, statusMsg]);

  // Close picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      {/* Status bubble */}
      {showStatus && (statusMsg || transcript) && (
        <div className="fixed bottom-28 right-6 max-w-xs z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4">
            {transcript && (
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <Mic className="w-3 h-3" /> Heard:
                <span className="text-gray-600 dark:text-gray-300 italic ml-1">"{transcript}"</span>
              </p>
            )}
            {statusMsg && (
              <p className="text-sm text-gray-800 dark:text-white font-medium">{statusMsg}</p>
            )}
          </div>
        </div>
      )}

      {/* Language picker */}
      {showPicker && (
        <div
          ref={pickerRef}
          className="fixed bottom-28 right-6 w-72 z-50 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" /> Select Language
            </span>
            <button onClick={() => setShowPicker(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto max-h-80">
            {/* Indian languages */}
            <div className="px-3 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">
                🇮🇳 Indian Languages
              </p>
              <div className="grid grid-cols-2 gap-1">
                {INDIAN_LANGS.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => { switchLanguage(lang.code); setShowPicker(false); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors text-left ${
                      currentLang === lang.code
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span className="truncate">{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* International languages */}
            <div className="px-3 pt-2 pb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1 mt-2">
                🌍 International
              </p>
              <div className="grid grid-cols-2 gap-1">
                {INTL_LANGS.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => { switchLanguage(lang.code); setShowPicker(false); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors text-left ${
                      currentLang === lang.code
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span className="truncate">{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAB group */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2 z-50">

        {/* Language selector pill */}
        <button
          onClick={() => setShowPicker(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-blue-400 transition-all"
        >
          <span>{currentLangInfo.flag}</span>
          <span>{currentLangInfo.label}</span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>

        {/* Mic FAB */}
        <button
          onClick={isListening ? stopListening : startListening}
          className={`relative w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
            isListening
              ? 'bg-gradient-to-br from-pink-500 to-pink-600 shadow-pink-500/50 scale-110'
              : 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/50 hover:scale-110'
          }`}
          title={isListening ? 'Stop Voice Assistant' : 'Start Voice Assistant'}
        >
          {isListening && (
            <>
              <span className="absolute inset-0 rounded-full bg-pink-400 animate-ping opacity-30" />
              <span className="absolute inset-0 rounded-full bg-pink-500 animate-pulse opacity-20" />
            </>
          )}
          {isListening
            ? <Mic className="w-8 h-8 text-white relative z-10" />
            : <MicOff className="w-8 h-8 text-white" />
          }
        </button>
      </div>
    </>
  );
}