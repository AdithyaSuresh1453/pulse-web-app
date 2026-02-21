import { Mic, MicOff } from 'lucide-react';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';

export function VoiceAssistant() {
  const { isListening, startListening, stopListening } = useVoiceAssistant();

  return (
    <button
      onClick={isListening ? stopListening : startListening}
      className={`fixed bottom-6 right-6 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 z-50 ${
        isListening
          ? 'bg-gradient-to-br from-pink-500 to-pink-600 shadow-pink-500/50 scale-110 animate-pulse'
          : 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/50 hover:scale-110'
      }`}
      title={isListening ? 'Stop Voice Assistant' : 'Start Voice Assistant'}
    >
      {isListening ? (
        <Mic className="w-8 h-8 text-white" />
      ) : (
        <MicOff className="w-8 h-8 text-white" />
      )}
    </button>
  );
}
