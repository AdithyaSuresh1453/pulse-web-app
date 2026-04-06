import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Smartphone, MapPin, Radio, Volume2, Navigation,
  Clock, AlertCircle, Link2, Copy, CheckCheck, Trash2
} from "lucide-react";
import { showNotification } from "../../components/NotificationSystem";

const generateSessionId = () =>
  Math.random().toString(36).substring(2, 7).toUpperCase();

interface RemoteLocation {
  lat: number;
  lng: number;
  accuracy: number;
  updatedAt: number;
}

export function PhoneRecovery() {
  const [sessionId] = useState(generateSessionId);
  const [remoteLocation, setRemoteLocation] = useState<RemoteLocation | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const trackingLink = `${window.location.origin}/track?s=${sessionId}`;

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((pos) =>
      setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    );
  }, []);

  useEffect(() => {
    if (!lastSeen) return;
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastSeen.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastSeen]);

  useEffect(() => {
    if (!isTracking || !lastSeen) return;
    const timeout = setTimeout(() => setIsConnected(false), 15000);
    return () => clearTimeout(timeout);
  }, [lastSeen, isTracking]);

  const startTracking = useCallback(() => {
    setIsTracking(true);
    setIsConnected(false);

    const channel = supabase.channel(`track-${sessionId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "location" }, ({ payload }) => {
      const loc = payload as RemoteLocation;
      setRemoteLocation(loc);
      setLastSeen(new Date(loc.updatedAt));
      setIsConnected(true);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        showNotification("Tracking Started", "Share the link with the phone you want to locate.", "success");
      }
    });

    channelRef.current = channel;
  }, [sessionId]);

  const stopTracking = useCallback(async () => {
    setIsTracking(false);
    setIsConnected(false);
    setRemoteLocation(null);
    setLastSeen(null);
    setSecondsAgo(null);

    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    showNotification("Tracking Stopped", "Session ended.", "info");
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const copyLink = () => {
    navigator.clipboard.writeText(trackingLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const sendViaSMS = () => {
    const body = encodeURIComponent("Open this link to share your location with me: " + trackingLink);
    window.location.href = `sms:?body=${body}`;
  };

  const openDirections = () => {
    if (!directionsUrl) return;
    window.open(directionsUrl, "_blank", "noopener,noreferrer");
  };

  const playSound = () => {
    setIsPlaying(true);
    try {
      const ctx = new AudioContext();
      audioRef.current = ctx;
      const playBeep = (time: number, freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
        osc.start(time);
        osc.stop(time + 0.4);
      };
      const now = ctx.currentTime;
      [880, 1100, 1320, 1540, 1760].forEach((freq, i) => playBeep(now + i * 0.5, freq));
      setTimeout(() => { setIsPlaying(false); ctx.close(); }, 3000);
    } catch {
      setIsPlaying(false);
    }
  };

  const mapUrl = remoteLocation
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${remoteLocation.lng - 0.01},${remoteLocation.lat - 0.01},${remoteLocation.lng + 0.01},${remoteLocation.lat + 0.01}&layer=mapnik&marker=${remoteLocation.lat},${remoteLocation.lng}`
    : null;

  const directionsUrl = remoteLocation
    ? userLocation
      ? `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${remoteLocation.lat},${remoteLocation.lng}`
      : `https://www.google.com/maps/dir//${remoteLocation.lat},${remoteLocation.lng}`
    : null;

  const formatSecondsAgo = (s: number) =>
    s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ${s % 60}s ago`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Phone Recovery</h1>
        <p className="text-gray-600 dark:text-gray-400">Locate another device in real time</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Map panel */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Live Location</h2>
            {isTracking && (
              <span className={`flex items-center gap-1.5 text-xs font-bold ${
                isConnected ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"
              }`}>
                <span className={`w-2 h-2 rounded-full inline-block ${
                  isConnected ? "bg-green-500 animate-ping" : "bg-yellow-500 animate-pulse"
                }`} />
                {isConnected ? "LIVE" : "WAITING"}
              </span>
            )}
          </div>

          <div className="rounded-2xl h-64 mb-4 overflow-hidden relative bg-gray-100 dark:bg-gray-700">
            {!isTracking ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                <MapPin className="w-10 h-10 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Start a session, share the link, and the other phone's location will appear here.
                </p>
              </div>
            ) : !remoteLocation ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Waiting for other phone to connect…</p>
              </div>
            ) : (
              <iframe
                src={mapUrl!}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                title="Remote Device Location"
                loading="lazy"
              />
            )}
          </div>

          <div className="space-y-2">
            {lastSeen && (
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Last update</span>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {secondsAgo !== null ? formatSecondsAgo(secondsAgo) : "—"}
                </span>
              </div>
            )}

            {remoteLocation && (
              <>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">GPS accuracy</span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    ±{Math.round(remoteLocation.accuracy)}m
                  </span>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">Coordinates</p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 font-mono">
                    {remoteLocation.lat.toFixed(6)}, {remoteLocation.lng.toFixed(6)}
                  </p>
                </div>
              </>
            )}

            {isTracking && !isConnected && remoteLocation && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  No updates recently — the other phone may have closed the link.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Share link */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Tracking link</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Send this to the phone you want to locate. When they open it, their GPS starts sending here.
            </p>

            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl mb-3">
              <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 font-mono">
                {trackingLink}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-300"
              >
                {copied
                  ? <><CheckCheck className="w-4 h-4 text-green-500" /> Copied!</>
                  : <><Copy className="w-4 h-4" /> Copy link</>
                }
              </button>

              <button
                onClick={sendViaSMS}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                <Smartphone className="w-4 h-4" /> Send via SMS
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Controls</h2>
            <div className="space-y-3">

              <button
                onClick={isTracking ? stopTracking : startTracking}
                className={`w-full py-4 rounded-2xl font-medium flex items-center justify-center gap-2 transition-all ${
                  isTracking
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {isTracking
                  ? <><Trash2 className="w-5 h-5" /> Stop &amp; End Session</>
                  : <><Smartphone className="w-5 h-5" /> Start Tracking Session</>
                }
              </button>

              <button
                onClick={playSound}
                disabled={isPlaying}
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Volume2 className={`w-5 h-5 ${isPlaying ? "animate-pulse" : ""}`} />
                {isPlaying ? "Playing…" : "Play Alert Sound"}
              </button>

              {directionsUrl && (
                <button
                  onClick={openDirections}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-medium flex items-center justify-center gap-2 transition-all"
                >
                  <Navigation className="w-5 h-5" /> Get Directions
                </button>
              )}

            </div>
          </div>

          {/* Session info */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-4 border border-gray-200 dark:border-gray-700 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Session ID</span>
              <span className="font-mono text-sm font-bold text-gray-900 dark:text-white tracking-widest">
                {sessionId}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Channel</span>
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                track-{sessionId}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}