import { registerPlugin, Capacitor } from '@capacitor/core';
import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NativeDetection {
  label: string;
  confidence: number;
  isRegistered: boolean;
  isUnusual: boolean;
  displayName: string;
  usualLocation: string;
  source: 'mlkit' | 'claude';
  locationHint?: string;

  // Bounding box
  bbox_x?: number;
  bbox_y?: number;
  bbox_w?: number;
  bbox_h?: number;
}

export interface RegisteredObjectInput {
  id: string;
  object_name: string;
  usual_location: string;
}

export interface CameraDetectionPlugin {
  startDetection(options: {
    objects: RegisteredObjectInput[];
    room: string;
  }): Promise<{ started: boolean }>;

  stopDetection(): Promise<{ stopped: boolean }>;

  setRoom(options: { room: string }): Promise<void>;

  setObjects(options: { objects: RegisteredObjectInput[] }): Promise<void>;

  isRunning(): Promise<{ running: boolean }>;

  addListener(
    event: 'detectionResult',
    handler: (data: { detections: NativeDetection[] }) => void
  ): Promise<{ remove: () => void }>;

  addListener(
    event: 'alert',
    handler: (data: { objectName: string; message: string }) => void
  ): Promise<{ remove: () => void }>;

  addListener(
    event: 'serviceStatus',
    handler: (data: { running: boolean }) => void
  ): Promise<{ remove: () => void }>;

  removeAllListeners(): Promise<void>;
}

// ─── Plugin Registration ─────────────────────────────────────────────────────

export const CameraDetection =
  registerPlugin<CameraDetectionPlugin>('CameraDetection');

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useNativeDetection(
  registeredObjects: RegisteredObjectInput[],
  currentRoom: string | null
) {
  const isSupported = Capacitor.isNativePlatform();

  const [detections, setDetections] = useState<NativeDetection[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const listenersRef = useRef<Array<{ remove: () => void }>>([]);

  // ── Start Detection ────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (!isSupported) return;

    try {
      await CameraDetection.startDetection({
        objects: registeredObjects,
        room: currentRoom ?? 'Unknown Room',
      });

      setIsRunning(true);
    } catch (e) {
      console.error('[NativeDetection] start failed:', e);
    }
  }, [registeredObjects, currentRoom, isSupported]);

  // ── Stop Detection ─────────────────────────────────────────────────────────

  const stop = useCallback(async () => {
    if (!isSupported) return;

    try {
      await CameraDetection.stopDetection();
      setIsRunning(false);
      setDetections([]);
    } catch (e) {
      console.error('[NativeDetection] stop failed:', e);
    }
  }, [isSupported]);

  // ── Sync Room ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isSupported || !isRunning) return;

    CameraDetection.setRoom({
      room: currentRoom ?? 'Unknown Room',
    });
  }, [currentRoom, isRunning, isSupported]);

  // ── Sync Objects ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isSupported || !isRunning) return;

    CameraDetection.setObjects({
      objects: registeredObjects,
    });
  }, [registeredObjects, isRunning, isSupported]);

  // ── Event Listeners ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isSupported) return;

    let mounted = true;

    const setupListeners = async () => {
      try {
        // Cleanup old listeners
        listenersRef.current.forEach(l => l.remove());
        listenersRef.current = [];

        const detectionListener = await CameraDetection.addListener(
          'detectionResult',
          ({ detections }) => {
            if (mounted) setDetections(detections);
          }
        );

        const alertListener = await CameraDetection.addListener(
          'alert',
          ({ message }) => {
            if (mounted) {
              setAlerts(prev => [message, ...prev].slice(0, 20));
            }
          }
        );

        const statusListener = await CameraDetection.addListener(
          'serviceStatus',
          ({ running }) => {
            if (mounted) setIsRunning(running);
          }
        );

        listenersRef.current = [
          detectionListener,
          alertListener,
          statusListener,
        ];
      } catch (e) {
        console.error('[NativeDetection] listener setup failed:', e);
      }
    };

    setupListeners();

    return () => {
      mounted = false;
      listenersRef.current.forEach(l => l.remove());
      listenersRef.current = [];
    };
  }, [isSupported]);

  // ── Derived Data ───────────────────────────────────────────────────────────

  const registeredDetections = detections.filter(d => d.isRegistered);
  const unusualDetections = registeredDetections.filter(d => d.isUnusual);
  const normalDetections = registeredDetections.filter(d => !d.isUnusual);
  const unregisteredDetections = detections.filter(d => !d.isRegistered);

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    // state
    detections,
    alerts,
    isRunning,
    isSupported,

    // grouped
    registeredDetections,
    unusualDetections,
    normalDetections,
    unregisteredDetections,

    // actions
    start,
    stop,
    clearAlerts: () => setAlerts([]),
  };
}