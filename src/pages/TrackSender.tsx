import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { MapPin, Radio, CheckCircle, AlertCircle, ShieldCheck } from "lucide-react";

export function TrackSender() {
  const [status, setStatus] = useState<"idle" | "requesting" | "sharing" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("s");

  useEffect(() => {
    if (!sessionId) return;
    setStatus("requesting");

    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMsg("This browser doesn't support location sharing.");
      return;
    }

    const channel = supabase.channel(`track-${sessionId}`, {
      config: { broadcast: { self: false } },
    });

    channel.subscribe((subStatus) => {
      if (subStatus !== "SUBSCRIBED") return;

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const payload = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            updatedAt: Date.now(),
          };
          setCoords({ lat: payload.lat, lng: payload.lng });
          setStatus("sharing");
          channel.send({
            type: "broadcast",
            event: "location",
            payload,
          });
        },
        (err) => {
          setStatus("error");
          switch (err.code) {
            case err.PERMISSION_DENIED:
              setErrorMsg("Location permission denied. Please allow access and reload.");
              break;
            case err.POSITION_UNAVAILABLE:
              setErrorMsg("Location information is unavailable.");
              break;
            case err.TIMEOUT:
              setErrorMsg("Location request timed out. Please reload and try again.");
              break;
            default:
              setErrorMsg("Unable to get your location.");
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">Invalid tracking link</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            The link you opened is missing a session ID. Ask the sender to share the link again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-sm w-full space-y-6">

        {/* Status card */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-lg text-center space-y-5">

          {status === "requesting" && (
            <>
              <div className="w-20 h-20 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <MapPin className="w-10 h-10 text-blue-500 animate-pulse" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">Allow location access</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                  Tap <span className="font-medium text-gray-700 dark:text-gray-300">Allow</span> when
                  your browser asks. Your location will only be shared with the person who sent this link.
                </p>
              </div>
            </>
          )}

          {status === "sharing" && (
            <>
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full bg-green-500 opacity-20 animate-ping" />
                <div className="relative w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Radio className="w-10 h-10 text-green-500" />
                </div>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">Sharing your location</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                  Keep this page open. Your location updates every few seconds.
                  Closing this tab stops sharing immediately.
                </p>
              </div>
              {coords && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-2xl text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">Live — sending now</span>
                  </div>
                  <p className="text-xs font-mono text-green-600 dark:text-green-300">
                    {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                  </p>
                </div>
              )}
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-20 h-20 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">Location unavailable</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">{errorMsg}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-medium transition-colors"
              >
                Try again
              </button>
            </>
          )}

        </div>

        {/* Privacy note */}
        <div className="flex items-start gap-3 px-2">
          <ShieldCheck className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
            Your location is streamed directly to the session and is not stored in any database.
            Sharing stops the moment you close this tab.
          </p>
        </div>

      </div>
    </div>
  );
}