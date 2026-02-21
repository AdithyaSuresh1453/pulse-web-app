import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function useVoiceAssistant() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as unknown as { webkitSpeechRecognition: typeof window.SpeechRecognition }).webkitSpeechRecognition || window.SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
        handleCommand(transcript);
      };

      recognitionInstance.onerror = () => {
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        if (isListening) {
          recognitionInstance.start();
        }
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCommand = async (transcript: string) => {
    if (transcript.includes('where are my') || transcript.includes('where is my')) {
      const objectName = transcript
        .replace('where are my', '')
        .replace('where is my', '')
        .trim();

      const { data } = await supabase
        .from('objects')
        .select('object_name, last_known_location, last_detected_time')
        .eq('user_id', user?.id)
        .ilike('object_name', `%${objectName}%`)
        .maybeSingle();

      if (data) {
        if (data.last_known_location) {
          speak(
            `Your ${data.object_name} was last seen at ${data.last_known_location} ${
              data.last_detected_time
                ? `on ${new Date(data.last_detected_time).toLocaleString()}`
                : ''
            }`
          );
        } else {
          speak(`Your ${data.object_name} has not been detected yet`);
        }
      } else {
        speak(`I couldn't find ${objectName} in your registered objects`);
      }
    } else if (transcript.includes('start camera') || transcript.includes('open camera')) {
      speak('Opening camera detection');
      navigate('/dashboard/camera');
    } else if (transcript.includes('show objects') || transcript.includes('my objects')) {
      speak('Showing your registered objects');
      navigate('/dashboard/objects');
    } else if (transcript.includes('add object') || transcript.includes('register object')) {
      speak('Opening add object form');
      navigate('/dashboard/add-object');
    } else if (transcript.includes('show alerts') || transcript.includes('show history')) {
      speak('Opening alerts and history');
      navigate('/dashboard/alerts');
    } else if (transcript.includes('phone recovery') || transcript.includes('find my phone')) {
      speak('Opening phone recovery');
      navigate('/dashboard/phone-recovery');
    } else if (transcript.includes('go to dashboard') || transcript.includes('show dashboard')) {
      speak('Opening dashboard overview');
      navigate('/dashboard');
    } else if (transcript.includes('settings')) {
      speak('Opening settings');
      navigate('/dashboard/settings');
    }
  };

  const startListening = () => {
    if (recognition && !isListening) {
      setIsListening(true);
      recognition.start();
      speak('Voice assistant activated');
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      setIsListening(false);
      recognition.stop();
      speak('Voice assistant deactivated');
    }
  };

  return {
    isListening,
    startListening,
    stopListening,
  };
}
