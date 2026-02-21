import { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface VoiceLockProps {
  mode: 'register' | 'verify';
  onSuccess: () => void;
  onCancel: () => void;
}

export function VoiceLock({ mode, onSuccess, onCancel }: VoiceLockProps) {
  const { registerVoicePassphrase, verifyVoicePassphrase } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as unknown as { webkitSpeechRecognition: typeof window.SpeechRecognition }).webkitSpeechRecognition || window.SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        const speechResult = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;

        setTranscript(speechResult);
        setIsListening(false);

        if (confidence < 0.7) {
          setError('Low confidence. Please try again in a quiet environment.');
          speak('Low confidence detected. Please try again.');
          return;
        }

        if (mode === 'register') {
          handleRegister(speechResult);
        } else {
          handleVerify(speechResult);
        }
      };

      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false);
        setError(`Speech recognition error: ${event.error}`);
        speak('An error occurred. Please try again.');
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }
  }, [mode]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const startListening = () => {
    if (!recognition) {
      setError('Speech recognition is not supported in your browser.');
      return;
    }

    setError('');
    setTranscript('');
    setIsListening(true);

    if (mode === 'register') {
      speak('Please speak your passphrase clearly');
    } else {
      speak('Please speak your passphrase to unlock');
    }

    try {
      recognition.start();
    } catch (error) {
      setError('Failed to start speech recognition');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
      setIsListening(false);
    }
  };

  const handleRegister = async (spokenText: string) => {
    if (!passphrase.trim()) {
      setError('Please enter a passphrase first');
      return;
    }

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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-md w-full">
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

        {mode === 'register' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Create Your Passphrase
            </label>
            <input
              type="text"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="e.g., My secret is secure"
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Choose a unique phrase that's easy to remember but hard to guess
            </p>
          </div>
        )}

        <div className="flex flex-col items-center justify-center py-8">
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={mode === 'register' && !passphrase.trim()}
            className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-gradient-to-br from-pink-400 to-pink-600 shadow-lg shadow-pink-500/50 scale-110'
                : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isListening ? (
              <>
                <Mic className="w-12 h-12 text-white" />
                <div className="absolute inset-0 rounded-full border-4 border-pink-300 animate-ping" />
                <div className="absolute inset-0 rounded-full border-4 border-pink-400 animate-pulse" />
              </>
            ) : (
              <MicOff className="w-12 h-12 text-white" />
            )}
          </button>

          <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
            {isListening ? 'Listening...' : 'Tap to Start'}
          </p>

          {transcript && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Volume2 className="w-4 h-4" />
                <span className="text-sm font-medium">Detected:</span>
              </div>
              <p className="text-sm text-green-800 dark:text-green-300 mt-1">{transcript}</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
