import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Volume2, AlertCircle } from 'lucide-react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Detection {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

export function LiveCamera() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastAnnouncement, setLastAnnouncement] = useState('');

  useEffect(() => {
    loadModel();
    return () => {
      stopCamera();
    };
  }, []);

  const loadModel = async () => {
    try {
      setIsLoading(true);
      const loadedModel = await cocoSsd.load();
      setModel(loadedModel);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load detection model');
      setIsLoading(false);
    }
  };

  const speak = (text: string) => {
    if (!voiceEnabled) return;
    if (text === lastAnnouncement) return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
      setLastAnnouncement(text);
    }
  };

  const startCamera = async () => {
    try {
      setError('');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsActive(true);
        speak('Camera detection started');
      }
    } catch (err) {
      setError('Failed to access camera. Please grant camera permissions.');
      speak('Camera access denied');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsActive(false);
      setDetections([]);
      speak('Camera detection stopped');
    }
  };

  const detectObjects = async () => {
    if (!model || !videoRef.current || !canvasRef.current || !isActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const predictions = await model.detect(video);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const detectedObjects: Detection[] = [];

    predictions.forEach((prediction) => {
      const [x, y, width, height] = prediction.bbox;

      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = '#10B981';
      ctx.fillRect(x, y - 30, width, 30);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(
        `${prediction.class} ${Math.round(prediction.score * 100)}%`,
        x + 5,
        y - 10
      );

      detectedObjects.push({
        class: prediction.class,
        score: prediction.score,
        bbox: prediction.bbox,
      });

      if (prediction.score > 0.7) {
        logDetection(prediction.class, prediction.score);
      }
    });

    setDetections(detectedObjects);

    if (predictions.length > 0 && predictions.some((p) => p.score > 0.7)) {
      const topDetection = predictions[0];
      speak(`Detected ${topDetection.class} with ${Math.round(topDetection.score * 100)} percent confidence`);
    }

    requestAnimationFrame(detectObjects);
  };

  const logDetection = async (objectClass: string, confidence: number) => {
    if (!user) return;

    const { data: matchingObject } = await supabase
      .from('objects')
      .select('id, object_name')
      .eq('user_id', user.id)
      .ilike('object_name', `%${objectClass}%`)
      .maybeSingle();

    if (matchingObject) {
      await supabase
        .from('objects')
        .update({
          last_known_location: 'Camera View',
          last_detected_time: new Date().toISOString(),
        })
        .eq('id', matchingObject.id);
    }

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      object_id: matchingObject?.id || null,
      activity_type: 'detected',
      location: 'Camera View',
      confidence,
      metadata: { detected_class: objectClass },
    });
  };

  useEffect(() => {
    if (isActive && model) {
      detectObjects();
    }
  }, [isActive, model]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Live Camera Detection
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Real-time object detection using AI
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={isActive ? stopCamera : startCamera}
              disabled={isLoading || !model}
              className={`px-6 py-3 rounded-2xl font-medium flex items-center gap-2 transition-all shadow-lg ${
                isActive
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30'
                  : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-green-500/30'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isActive ? (
                <>
                  <CameraOff className="w-5 h-5" />
                  Stop Camera
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  Start Camera
                </>
              )}
            </button>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={voiceEnabled}
                onChange={(e) => setVoiceEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Volume2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Voice Announcements
              </span>
            </label>
          </div>

          {isActive && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Live
              </span>
            </div>
          )}
        </div>

        <div className="relative bg-black rounded-2xl overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-auto"
            style={{ display: isActive ? 'block' : 'none' }}
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
            style={{ display: isActive ? 'block' : 'none' }}
          />

          {!isActive && (
            <div className="aspect-video flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <Camera className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">
                  {isLoading ? 'Loading AI model...' : 'Click Start Camera to begin detection'}
                </p>
              </div>
            </div>
          )}
        </div>

        {detections.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              Detected Objects ({detections.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {detections.map((detection, index) => (
                <div
                  key={index}
                  className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3"
                >
                  <p className="text-sm font-medium text-green-900 dark:text-green-300 capitalize">
                    {detection.class}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400">
                    {Math.round(detection.score * 100)}% confidence
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
        <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
          Privacy Notice
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-400">
          All detection processing happens locally in your browser. No video data is transmitted or stored on our servers.
        </p>
      </div>
    </div>
  );
}
