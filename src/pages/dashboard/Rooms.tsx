import { useEffect, useState, useRef } from 'react';
import {
  Home, Plus, Trash2, Upload, Loader2, MapPin,
  Layers, Check, X, Image, Camera, Star,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { showNotification } from '../../components/NotificationSystem';

interface Room {
  id: string;
  room_name: string;
  floor: string;
  description: string;
  image_url: string;
  image_urls: string[];
  created_at: string;
}

interface ImageEntry {
  id: string;
  file: File | null;
  preview: string;
  fromCamera: boolean;
}

const MAX_IMAGES = 6;

const FLOOR_OPTIONS = [
  'Basement',
  'Ground Floor',
  'First Floor',
  'Second Floor',
  'Third Floor',
  'Attic / Top Floor',
];

export function Rooms() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
 

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [floor, setFloor] = useState('Ground Floor');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraTarget, setCameraTarget] = useState<'form' | string>('form'); // 'form' or room.id
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Per-room gallery lightbox
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null);

  useEffect(() => { loadRooms(); }, [user]);

  async function loadRooms() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('user_id', user.id)
      .order('floor')
      .order('room_name');
    if (data) setRooms(data as Room[]);
    setLoading(false);
  }

  // ── Camera helpers ───────────────────────────────────────────
  async function openCamera(target: 'form' | string = 'form') {
    setCameraTarget(target);
    setCameraError('');
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch { setCameraError('Camera access denied or unavailable.'); }
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
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const preview = URL.createObjectURL(blob);
      if (cameraTarget === 'form') {
        addFormImage(file, preview, true);
      } else {
        handleRoomPhotoAdd(cameraTarget, file);
      }
      closeCamera();
    }, 'image/jpeg', 0.92);
  }

  // ── Form image helpers ───────────────────────────────────────
  function addFormImage(file: File, preview: string, fromCamera: boolean) {
    if (images.length >= MAX_IMAGES) {
      showNotification('Limit reached', `Max ${MAX_IMAGES} photos.`, 'error', false);
      return;
    }
    setImages(prev => [...prev, { id: `img-${Date.now()}-${Math.random()}`, file, preview, fromCamera }]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files ?? []).slice(0, MAX_IMAGES - images.length).forEach(file => {
      addFormImage(file, URL.createObjectURL(file), false);
    });
    e.target.value = '';
  }

  function removeFormImage(id: string) {
    setImages(prev => prev.filter(img => img.id !== id));
  }

  // ── Upload helpers ───────────────────────────────────────────
  async function uploadRoomImage(file: File, roomId: string, suffix = ''): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${user!.id}/rooms/${roomId}-${Date.now()}${suffix}.${ext}`;
    const { error } = await supabase.storage.from('object-images').upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from('object-images').getPublicUrl(path);
    return data.publicUrl;
  }

  // ── Add room ─────────────────────────────────────────────────
  async function handleAddRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !roomName.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('rooms').insert({
        user_id: user.id,
        room_name: roomName.trim(),
        floor,
        description: description.trim(),
        image_url: '',
        image_urls: [],
      }).select().single();

      if (error) throw error;

      const uploadedUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const entry = images[i];
        if (entry.file) {
          const url = await uploadRoomImage(entry.file, data.id, `-${i}`);
          uploadedUrls.push(url);
        }
      }

      if (uploadedUrls.length > 0) {
        await supabase.from('rooms').update({
          image_url: uploadedUrls[0],
          image_urls: uploadedUrls,
        }).eq('id', data.id);
      }

      showNotification('Room Added', `"${roomName}" added with ${uploadedUrls.length} photo(s).`, 'success', false);
      setRoomName(''); setFloor('Ground Floor'); setDescription('');
      setImages([]); setShowForm(false);
      loadRooms();
    } catch {
      showNotification('Error', 'Failed to add room. Please try again.', 'error', false);
    }
    setSaving(false);
  }

  // ── Add photo to existing room ───────────────────────────────
  async function handleRoomPhotoAdd(roomId: string, file: File) {
    if (!user) return;
    setUploadingId(roomId);
    try {
      const room = rooms.find(r => r.id === roomId);
      const existingUrls: string[] = room?.image_urls ?? (room?.image_url ? [room.image_url] : []);
      if (existingUrls.length >= MAX_IMAGES) {
        showNotification('Limit reached', `Max ${MAX_IMAGES} photos per room.`, 'error', false);
        setUploadingId(null);
        return;
      }
      const url = await uploadRoomImage(file, roomId, `-${existingUrls.length}`);
      const newUrls = [...existingUrls, url];
      await supabase.from('rooms').update({
        image_url: newUrls[0],
        image_urls: newUrls,
      }).eq('id', roomId);
      loadRooms();
    } catch {
      showNotification('Error', 'Failed to upload photo.', 'error', false);
    }
    setUploadingId(null);
  }

  async function handleRoomPhotoUpload(e: React.ChangeEvent<HTMLInputElement>, roomId: string) {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) await handleRoomPhotoAdd(roomId, file);
    e.target.value = '';
  }

  async function handleDeleteRoomPhoto(room: Room, urlToDelete: string) {
    const existing = room.image_urls?.length ? room.image_urls : (room.image_url ? [room.image_url] : []);
    const newUrls = existing.filter(u => u !== urlToDelete);
    await supabase.from('rooms').update({
      image_url: newUrls[0] ?? '',
      image_urls: newUrls,
    }).eq('id', room.id);
    loadRooms();
  }

  async function handleDeleteRoom(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This won't affect your registered objects.`)) return;
    await supabase.from('rooms').delete().eq('id', id);
    showNotification('Room Deleted', `"${name}" has been removed.`, 'info', false);
    loadRooms();
  }

  const grouped = rooms.reduce<Record<string, Room[]>>((acc, room) => {
    (acc[room.floor] ??= []).push(room);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Rooms</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Register your rooms so the camera knows exactly where objects are
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl font-medium shadow-lg shadow-blue-500/30 transition-all"
        >
          {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {showForm ? 'Cancel' : 'Add Room'}
        </button>
      </div>

      {/* Add room form */}
      {showForm && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-blue-200 dark:border-blue-800 shadow-lg">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-500" />New Room
          </h2>
          <form onSubmit={handleAddRoom} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Room Name *</label>
                <input
                  value={roomName} onChange={e => setRoomName(e.target.value)}
                  placeholder="e.g. Living Room, Study, Master Bedroom" required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Floor / Level</label>
                <select value={floor} onChange={e => setFloor(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {FLOOR_OPTIONS.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Description <span className="text-gray-400">(optional)</span>
              </label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Room next to kitchen, has blue sofa"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Photo section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Room Photos <span className="text-gray-400">({images.length}/{MAX_IMAGES})</span>
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    disabled={images.length >= MAX_IMAGES}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-40"
                  ><Upload className="w-3.5 h-3.5" /> Upload</button>
                  <button type="button" onClick={() => openCamera('form')}
                    disabled={images.length >= MAX_IMAGES}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40"
                  ><Camera className="w-3.5 h-3.5" /> Camera</button>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />

              {images.length === 0 ? (
                <div onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-2xl h-32 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-400 transition-colors"
                >
                  <Image className="w-7 h-7" />
                  <p className="text-sm">Click to upload or use camera</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, idx) => (
                    <div key={img.id} className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                      <img src={img.preview} alt="" className="w-full h-24 object-cover" />
                      {idx === 0 && (
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5" /> Primary
                        </div>
                      )}
                      {img.fromCamera && (
                        <div className="absolute top-1 right-6 p-0.5 bg-black/50 rounded">
                          <Camera className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      <button type="button" onClick={() => removeFormImage(img.id)}
                        className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      ><X className="w-2.5 h-2.5" /></button>
                    </div>
                  ))}
                  {images.length < MAX_IMAGES && (
                    <div className="flex flex-col gap-1.5">
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="flex-1 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-400 transition-colors h-11"
                      ><Upload className="w-3.5 h-3.5" /><span className="text-xs">Upload</span></button>
                      <button type="button" onClick={() => openCamera('form')}
                        className="flex-1 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-xl flex flex-col items-center justify-center gap-1 text-blue-400 hover:border-blue-500 transition-colors h-11"
                      ><Camera className="w-3.5 h-3.5" /><span className="text-xs">Camera</span></button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save Room'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setImages([]); }}
                className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}

      {!loading && rooms.length === 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-12 border border-gray-200 dark:border-gray-700 text-center">
          <Home className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No rooms yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            Add your rooms so the camera can accurately report which room an object was found in.
          </p>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-medium mx-auto transition-colors">
            <Plus className="w-5 h-5" />Add Your First Room
          </button>
        </div>
      )}

      {/* Rooms grouped by floor */}
      {!loading && Object.entries(grouped).map(([floorName, floorRooms]) => (
        <div key={floorName}>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{floorName}</h2>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span className="text-xs text-gray-400">{floorRooms.length} room{floorRooms.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {floorRooms.map(room => {
              const allUrls: string[] = room.image_urls?.length
                ? room.image_urls
                : (room.image_url ? [room.image_url] : []);

              return (
                <div key={room.id} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden group">

                  {/* Primary photo + thumbnail strip */}
                  <div className="relative">
                    <div className="relative h-40 bg-gray-100 dark:bg-gray-700">
                      {allUrls.length > 0 ? (
                        <img
                          src={allUrls[0]} alt={room.room_name}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setLightbox({ urls: allUrls, idx: 0 })}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300 dark:text-gray-600">
                          <Home className="w-12 h-12" /><p className="text-xs">No photo</p>
                        </div>
                      )}

                      {/* Photo count badge */}
                      {allUrls.length > 1 && (
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded-lg">
                          1 / {allUrls.length}
                        </div>
                      )}

                      {/* Floor badge */}
                      <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg flex items-center gap-1">
                        <Layers className="w-3 h-3 text-white" />
                        <span className="text-xs text-white font-medium">{room.floor}</span>
                      </div>
                    </div>

                    {/* Thumbnail strip */}
                    {allUrls.length > 1 && (
                      <div className="flex gap-1 p-2 bg-gray-50 dark:bg-gray-900/40 overflow-x-auto">
                        {allUrls.map((url, idx) => (
                          <div key={url} className="relative shrink-0 group/thumb">
                            <img
                              src={url} alt=""
                              className="w-12 h-10 object-cover rounded-lg cursor-pointer border-2 border-transparent hover:border-blue-400 transition-colors"
                              onClick={() => setLightbox({ urls: allUrls, idx })}
                            />
                            <button
                              onClick={() => handleDeleteRoomPhoto(room, url)}
                              className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                            ><X className="w-2.5 h-2.5" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Room info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 dark:text-white truncate">{room.room_name}</h3>
                        {room.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{room.description}</p>
                        )}
                      </div>
                      <button onClick={() => handleDeleteRoom(room.id, room.room_name)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                      ><Trash2 className="w-4 h-4" /></button>
                    </div>

                    {/* Add photo buttons */}
                    {allUrls.length < MAX_IMAGES && (
                      <div className="flex gap-2 mb-3">
                        <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          {allUrls.length === 0 ? 'Add Photo' : 'Add More'}
                          <input type="file" accept="image/*" multiple className="hidden"
                            onChange={e => handleRoomPhotoUpload(e, room.id)} />
                        </label>
                        <button
                          onClick={() => openCamera(room.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          {uploadingId === room.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                          Camera
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Use this name when setting object locations</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {rooms.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
          <p className="text-sm text-blue-800 dark:text-blue-400">
            💡 <strong>How to use:</strong> When registering an object, set its <em>usual location</em> to a room name from this list.
            When the camera detects it elsewhere, it will show a red alert. Tap any photo to view full screen.
          </p>
        </div>
      )}

      {/* ── Camera modal ────────────────────────────────────────── */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-3xl overflow-hidden w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Camera className="w-5 h-5 text-blue-400" /> Take Room Photo
              </div>
              <button type="button" onClick={closeCamera}
                className="p-2 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              ><X className="w-4 h-4" /></button>
            </div>
            <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 p-6 text-center">
                  <Camera className="w-12 h-12 opacity-30" />
                  <p className="text-sm">{cameraError}</p>
                </div>
              ) : (
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              )}
            </div>
            <div className="p-5">
              <button type="button" onClick={capturePhoto} disabled={!!cameraError}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
              ><Camera className="w-5 h-5" /> Capture Photo</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/30 transition-colors"
            onClick={() => setLightbox(null)}
          ><X className="w-5 h-5" /></button>

          <button
            className="absolute left-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/30 transition-colors disabled:opacity-30"
            disabled={lightbox.idx === 0}
            onClick={e => { e.stopPropagation(); setLightbox(l => l && l.idx > 0 ? { ...l, idx: l.idx - 1 } : l); }}
          >‹</button>

          <img
            src={lightbox.urls[lightbox.idx]}
            alt=""
            className="max-w-full max-h-[80vh] rounded-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />

          <button
            className="absolute right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/30 transition-colors disabled:opacity-30"
            disabled={lightbox.idx === lightbox.urls.length - 1}
            onClick={e => { e.stopPropagation(); setLightbox(l => l && l.idx < l.urls.length - 1 ? { ...l, idx: l.idx + 1 } : l); }}
          >›</button>

          <div className="absolute bottom-4 flex gap-2">
            {lightbox.urls.map((_, i) => (
              <button key={i}
                className={`w-2 h-2 rounded-full transition-colors ${i === lightbox.idx ? 'bg-white' : 'bg-white/40'}`}
                onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, idx: i } : l); }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}