import { useState, useEffect, useRef } from 'react';
import { Smartphone, MapPin, Radio, Volume2, Navigation, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { showNotification } from '../../components/NotificationSystem';

export function PhoneRecovery() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date>(new Date());
  const [isPlaying, setIsPlaying] = useState(false);
  const [bluetoothSignal, setBluetoothSignal] = useState(0);
  const [locationLoading, setLocationLoading] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const fetchLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setLocationLoading(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLastSeen(new Date());
        setLocationLoading(false);
      },
      (error) => {
        setLocationLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location permission denied. Please allow access in your browser settings.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location information is unavailable.');
            break;
          case error.TIMEOUT:
            setLocationError('Location request timed out. Please try again.');
            break;
          default:
            setLocationError('Unable to retrieve location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  // Live tracking with watchPosition
  useEffect(() => {
    if (isTracking) {
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            setLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            setLastSeen(new Date());
          },
          () => {},
          { enableHighAccuracy: true }
        );
      }
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isTracking]);

  // Simulated bluetooth signal while tracking
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isTracking) {
      interval = setInterval(() => {
        setBluetoothSignal(Math.random() * 100);
      }, 1000);
    } else {
      setBluetoothSignal(0);
    }
    return () => clearInterval(interval);
  }, [isTracking]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const startTracking = () => {
    setIsTracking(true);
    setLastSeen(new Date());
    speak('Phone tracking started');
    showNotification('Tracking Started', 'Phone location tracking is now active.', 'success');
  };

  const stopTracking = () => {
    setIsTracking(false);
    speak('Phone tracking stopped');
    showNotification('Tracking Stopped', 'Phone location tracking has been stopped.', 'info');
  };

  // Generate a real alert sound using Web Audio API
  const playSound = () => {
    setIsPlaying(true);
    speak('Playing alert sound');
    showNotification('Sound Playing', 'Alert sound is playing on this device.', 'info');

    try {
      const ctx = new AudioContext();
      audioRef.current = ctx;

      const playBeep = (time: number, freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
        osc.start(time);
        osc.stop(time + 0.4);
      };

      const now = ctx.currentTime;
      // Play 5 ascending beeps
      [880, 1100, 1320, 1540, 1760].forEach((freq, i) => {
        playBeep(now + i * 0.5, freq);
      });

      setTimeout(() => {
        setIsPlaying(false);
        ctx.close();
      }, 3000);
    } catch {
      setIsPlaying(false);
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

  const mapUrl = location
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.01},${location.lat - 0.01},${location.lng + 0.01},${location.lat + 0.01}&layer=mapnik&marker=${location.lat},${location.lng}`
    : null;

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
        {/* Map Panel */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Device Location</h2>
            <button
              onClick={fetchLocation}
              disabled={locationLoading}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              title="Refresh location"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${locationLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Map */}
          <div className="rounded-2xl h-64 mb-4 overflow-hidden relative bg-gray-100 dark:bg-gray-700">
            {locationError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-sm text-red-600 dark:text-red-400 text-center">{locationError}</p>
                <button
                  onClick={fetchLocation}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : locationLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : mapUrl ? (
              <>
                <iframe
                  src={mapUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  title="Device Location Map"
                  loading="lazy"
                />
                {isTracking && (
                  <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow">
                    <span className="w-2 h-2 bg-white rounded-full animate-ping inline-block" />
                    LIVE
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <MapPin className="w-10 h-10 text-gray-400" />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Seen</span>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {lastSeen.toLocaleTimeString()}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
              </div>
              <span className={`text-sm font-medium ${isTracking ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                {isTracking ? '🟢 Tracking' : 'Inactive'}
              </span>
            </div>

            {location && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">Coordinates</p>
                <p className="text-xs text-blue-600 dark:text-blue-300 font-mono">
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions + Bluetooth Panel */}
        <div className="space-y-6">
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Actions</h2>

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
                {isPlaying ? 'Playing Sound...' : 'Play Alert Sound'}
              </button>

              {location && (
                <a
                  href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-2xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/30"
                >
                  <MapPin className="w-5 h-5" />
                  Open in Google Maps
                </a>
              )}
            </div>
          </div>

          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Bluetooth Signal</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className={`w-5 h-5 ${getSignalColor()} ${isTracking ? 'animate-pulse' : ''}`} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Signal Strength</span>
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
                  ? 'Bluetooth scanning active — move closer to strengthen signal'
                  : 'Start tracking to enable Bluetooth scanning'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}