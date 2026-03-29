import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Loader, Camera, X, Plus, MapPin,
  Home, AlignLeft, Star, ChevronDown, Image as ImageIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { showNotification } from '../../components/NotificationSystem';
import { useAuth } from '../../contexts/AuthContext';

interface Room {
  id: string;
  room_name: string;
  floor: string;
}

interface ImageEntry {
  id: string;
  file: File | null;
  preview: string;
  label: string; // e.g. "Front", "Back", "Detail"
  fromCamera: boolean;
}

const MAX_IMAGES = 6;

export function AddObject() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── form state ──────────────────────────────────────────────
  const [formData, setFormData] = useState({
    object_name: '',
    description: '',
    usual_location: '',      // room id or free text
    secondary_location: '',  // free text
    object_id: '',
  });

  const [images, setImages] = useState<ImageEntry[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── camera state ────────────────────────────────────────────
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraLabel, setCameraLabel] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── load rooms ───────────────────────────────────────────────
  useEffect(() => {
    async function fetchRooms() {
      if (!user) return;
      const { data } = await supabase
        .from('rooms')
        .select('id, room_name, floor')
        .eq('user_id', user.id)
        .order('room_name');
      if (data) setRooms(data as Room[]);
      setLoadingRooms(false);
    }
    fetchRooms();
  }, [user]);

  // ── camera helpers ───────────────────────────────────────────
  async function openCamera(label = '') {
    setCameraLabel(label);
    setCameraError('');
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setCameraError('Camera access denied or unavailable.');
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCameraError('');
  }

  function capturePhoto() {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width  = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      addImageEntry(file, URL.createObjectURL(blob), cameraLabel, true);
      closeCamera();
    }, 'image/jpeg', 0.92);
  }

  // ── image helpers ────────────────────────────────────────────
  function addImageEntry(
    file: File | null,
    preview: string,
    label: string,
    fromCamera: boolean,
  ) {
    if (images.length >= MAX_IMAGES) {
      showNotification('Limit reached', `You can add up to ${MAX_IMAGES} images.`, 'error');
      return;
    }
    setImages(prev => [
      ...prev,
      { id: `img-${Date.now()}-${Math.random()}`, file, preview, label, fromCamera },
    ]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.slice(0, MAX_IMAGES - images.length).forEach(file => {
      addImageEntry(file, URL.createObjectURL(file), '', false);
    });
    e.target.value = '';
  }

  function removeImage(id: string) {
    setImages(prev => prev.filter(img => img.id !== id));
  }

  function updateLabel(id: string, label: string) {
    setImages(prev => prev.map(img => img.id === id ? { ...img, label } : img));
  }

  // ── upload + submit ──────────────────────────────────────────
  async function uploadImageEntry(entry: ImageEntry): Promise<string> {
    if (!entry.file || !user) return entry.preview; // blob URL fallback (shouldn't happen)
    const ext = entry.file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('object-images')
      .upload(path, entry.file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('object-images').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!user) throw new Error('User not authenticated');

      // Upload all images
      const uploadedUrls: string[] = [];
      for (const entry of images) {
        const url = await uploadImageEntry(entry);
        uploadedUrls.push(url);
      }
      const primaryImage = uploadedUrls[0] ?? '';

      // Resolve room name for usual_location
      const selectedRoom = rooms.find(r => r.id === formData.usual_location);
      const locationLabel = selectedRoom ? selectedRoom.room_name : formData.usual_location;

      const { error: insertError } = await supabase.from('objects').insert({
        user_id:           user.id,
        object_name:       formData.object_name,
        description:       formData.description,
        usual_location:    locationLabel,
        secondary_location: formData.secondary_location,
        object_id:         formData.object_id || `OBJ-${Date.now()}`,
        image_url:         primaryImage,
        image_urls:        uploadedUrls,      // store all URLs
        image_labels:      images.map(i => i.label),
      });

      if (insertError) throw insertError;

      await supabase.from('activity_logs').insert({
        user_id:       user.id,
        activity_type: 'registered',
        location:      locationLabel,
        confidence:    1.0,
        metadata:      {
          object_name:        formData.object_name,
          secondary_location: formData.secondary_location,
          image_count:        uploadedUrls.length,
        },
      });

      showNotification(
        'Object Added',
        `${formData.object_name} has been registered with ${uploadedUrls.length} photo(s).`,
        'success',
      );
      navigate('/dashboard/objects');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
      showNotification('Error', msg, 'error');
      setLoading(false);
    }
  }

  // ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Add New Object
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Register a new belonging to track with photos and location details
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-lg space-y-7"
      >
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* ── PHOTOS SECTION ─────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-blue-500" />
              Photos
              <span className="text-gray-400 font-normal ml-1">
                ({images.length}/{MAX_IMAGES})
              </span>
            </label>

            <div className="flex gap-2">
              {/* Upload from device */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= MAX_IMAGES}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-40"
              >
                <Upload className="w-4 h-4" /> Upload
              </button>
              {/* Take photo */}
              <button
                type="button"
                onClick={() => openCamera()}
                disabled={images.length >= MAX_IMAGES}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40"
              >
                <Camera className="w-4 h-4" /> Camera
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Image grid */}
          {images.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-gray-50 dark:bg-gray-700/50"
            >
              <ImageIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Click to upload or use camera
              </p>
              <p className="text-xs text-gray-400 mt-1">Up to 6 photos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  className="relative group rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm"
                >
                  <img
                    src={img.preview}
                    alt={`object photo ${idx + 1}`}
                    className="w-full h-36 object-cover"
                  />

                  {/* Primary badge */}
                  {idx === 0 && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-lg flex items-center gap-1">
                      <Star className="w-3 h-3" /> Primary
                    </div>
                  )}

                  {/* Camera badge */}
                  {img.fromCamera && (
                    <div className="absolute top-2 right-8 px-1.5 py-0.5 bg-black/50 text-white text-xs rounded-lg">
                      <Camera className="w-3 h-3" />
                    </div>
                  )}

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>

                  {/* Label input */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <input
                      type="text"
                      value={img.label}
                      onChange={e => updateLabel(img.id, e.target.value)}
                      placeholder="Label (e.g. Front)"
                      className="w-full text-xs bg-transparent text-white placeholder-white/60 border-b border-white/40 focus:outline-none focus:border-white pb-0.5"
                    />
                  </div>
                </div>
              ))}

              {/* Add more slot */}
              {images.length < MAX_IMAGES && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center h-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-400 transition-colors text-gray-400 gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-xs">Upload</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openCamera()}
                    className="flex flex-col items-center justify-center h-16 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl hover:border-blue-500 transition-colors text-blue-400 gap-1"
                  >
                    <Camera className="w-4 h-4" />
                    <span className="text-xs">Camera</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400 mt-2">
            First photo is the primary image. Add labels to distinguish angles (Front, Back, Serial No…).
          </p>
        </div>

        {/* ── OBJECT NAME ───────────────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Object Name *
          </label>
          <input
            type="text"
            required
            value={formData.object_name}
            onChange={e => setFormData({ ...formData, object_name: e.target.value })}
            placeholder="e.g., Car Keys, Wallet, Laptop"
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors text-gray-900 dark:text-white"
          />
        </div>

        {/* ── DESCRIPTION ───────────────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
            <AlignLeft className="w-4 h-4 text-blue-500" />
            Description
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder="Colour, size, brand, distinguishing features… anything that helps identify it"
            rows={3}
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors text-gray-900 dark:text-white resize-none"
          />
        </div>

        {/* ── USUAL LOCATION (ROOM) ─────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
            <Home className="w-4 h-4 text-blue-500" />
            Usual Location *
          </label>

          {loadingRooms ? (
            <div className="flex items-center gap-2 px-4 py-3 text-gray-400 text-sm">
              <Loader className="w-4 h-4 animate-spin" /> Loading rooms…
            </div>
          ) : rooms.length > 0 ? (
            <>
              {/* Room picker */}
              <div className="relative mb-2">
                <select
                  value={formData.usual_location}
                  onChange={e => setFormData({ ...formData, usual_location: e.target.value })}
                  className="w-full appearance-none px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors text-gray-900 dark:text-white pr-10"
                >
                  <option value="">— Select a room —</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.room_name} ({r.floor})
                    </option>
                  ))}
                  <option value="__custom__">Other / Free text…</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Free-text fallback */}
              {(formData.usual_location === '__custom__' || (formData.usual_location && !rooms.find(r => r.id === formData.usual_location))) && (
                <input
                  type="text"
                  required
                  value={formData.usual_location === '__custom__' ? '' : formData.usual_location}
                  onChange={e => setFormData({ ...formData, usual_location: e.target.value })}
                  placeholder="e.g., Kitchen Counter, Office Desk"
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors text-gray-900 dark:text-white"
                />
              )}
            </>
          ) : (
            /* No rooms — free text */
            <>
              <input
                type="text"
                required
                value={formData.usual_location}
                onChange={e => setFormData({ ...formData, usual_location: e.target.value })}
                placeholder="e.g., Kitchen Counter, Living Room"
                className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors text-gray-900 dark:text-white"
              />
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                💡 <a href="/dashboard/rooms" className="underline">Add rooms</a> to pick from a list next time.
              </p>
            </>
          )}
        </div>

        {/* ── SECONDARY LOCATION ────────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-purple-500" />
            Secondary / Spot Location
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={formData.secondary_location}
            onChange={e => setFormData({ ...formData, secondary_location: e.target.value })}
            placeholder="e.g., Top drawer, Left shelf, Under the TV"
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:border-purple-400 dark:focus:border-purple-400 focus:outline-none transition-colors text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            The exact spot within the room — drawer, shelf, hook, bag…
          </p>
        </div>

        {/* ── CUSTOM ID ─────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Custom ID
            <span className="text-gray-400 font-normal ml-1">(optional — auto-generated if blank)</span>
          </label>
          <input
            type="text"
            value={formData.object_id}
            onChange={e => setFormData({ ...formData, object_id: e.target.value })}
            placeholder="Leave blank to auto-generate"
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors text-gray-900 dark:text-white"
          />
        </div>

        {/* ── ACTIONS ───────────────────────────────────────── */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/dashboard/objects')}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Adding…
              </>
            ) : (
              'Add Object'
            )}
          </button>
        </div>
      </form>

      {/* ── CAMERA MODAL ──────────────────────────────────────── */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-3xl overflow-hidden w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Camera className="w-5 h-5 text-blue-400" />
                Take Photo
                {cameraLabel && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full ml-1">
                    {cameraLabel}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="p-2 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video / error */}
            <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 p-6 text-center">
                  <Camera className="w-12 h-12 opacity-30" />
                  <p className="text-sm">{cameraError}</p>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Label + Capture */}
            <div className="p-5 space-y-3">
              <input
                type="text"
                value={cameraLabel}
                onChange={e => setCameraLabel(e.target.value)}
                placeholder="Photo label (e.g. Front, Serial No)"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!!cameraError}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
              >
                <Camera className="w-5 h-5" /> Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}