import { useState, useEffect } from 'react';
import { Smartphone, MapPin, Radio, Volume2, Navigation } from 'lucide-react';

export function PhoneRecovery() {
  const [location, setLocation] = useState({ lat: 0, lng: 0 });
  const [isTracking, setIsTracking] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date>(new Date());
  const [isPlaying, setIsPlaying] = useState(false);
  const [bluetoothSignal, setBluetoothSignal] = useState(0);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTracking) {
      interval = setInterval(() => {
        setBluetoothSignal(Math.random() * 100);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking]);

  const startTracking = () => {
    setIsTracking(true);
    setLastSeen(new Date());
    speak('Phone tracking started');
  };

  const stopTracking = () => {
    setIsTracking(false);
    setBluetoothSignal(0);
    speak('Phone tracking stopped');
  };

  const playSound = () => {
    setIsPlaying(true);
    speak('Playing sound on your phone');

    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLUgjMGGGS578yKOgkVY7fq5KVXFA1Hn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFA==');
    audio.play();

    setTimeout(() => {
      setIsPlaying(false);
    }, 3000);
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const getSignalStrength = () => {
    if (bluetoothSignal > 70) return 'Strong';
    if (bluetoothSignal > 40) return 'Medium';
    if (bluetoothSignal > 10) return 'Weak';
    return 'No Signal';
  };

  const getSignalColor = () => {
    if (bluetoothSignal > 70) return 'text-green-600 dark:text-green-400';
    if (bluetoothSignal > 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Phone Recovery
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Locate and track your mobile device
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Device Location
          </h2>

          <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl h-64 mb-4 overflow-hidden relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Simulated Map View
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Lat: {location.lat.toFixed(6)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Lng: {location.lng.toFixed(6)}
                </p>
              </div>
            </div>

            {isTracking && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-4 h-4 bg-blue-600 rounded-full animate-ping"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full"></div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Last Seen
                </span>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {lastSeen.toLocaleTimeString()}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Status
                </span>
              </div>
              <span className={`text-sm font-medium ${isTracking ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                {isTracking ? 'Tracking' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Actions
            </h2>

            <div className="space-y-3">
              <button
                onClick={isTracking ? stopTracking : startTracking}
                className={`w-full py-4 rounded-2xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg ${
                  isTracking
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-500/30'
                }`}
              >
                <Smartphone className="w-5 h-5" />
                {isTracking ? 'Stop Tracking' : 'Start Tracking'}
              </button>

              <button
                onClick={playSound}
                disabled={isPlaying}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-2xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Volume2 className={`w-5 h-5 ${isPlaying ? 'animate-pulse' : ''}`} />
                {isPlaying ? 'Playing Sound...' : 'Play Sound'}
              </button>
            </div>
          </div>

          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Bluetooth Signal
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className={`w-5 h-5 ${getSignalColor()} ${isTracking ? 'animate-pulse' : ''}`} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Signal Strength
                  </span>
                </div>
                <span className={`text-sm font-medium ${getSignalColor()}`}>
                  {getSignalStrength()}
                </span>
              </div>

              <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-300"
                  style={{ width: `${bluetoothSignal}%` }}
                />
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isTracking
                  ? 'Bluetooth scanning active - Move closer to strengthen signal'
                  : 'Start tracking to enable Bluetooth scanning'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
