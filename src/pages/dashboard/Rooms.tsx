import { useEffect, useState, useRef } from 'react';
import {
  Home, Plus, Trash2, Upload, Loader2, MapPin,
  Layers, Check, X, Image,
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
  created_at: string;
}

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
  const [showForm, setShowForm]     = useState(false);
  const [roomName, setRoomName]     = useState('');
  const [floor, setFloor]           = useState('Ground Floor');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile]   = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingId, setUploadingId]   = useState<string | null>(null);

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

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function uploadRoomImage(file: File, roomId: string): Promise<string> {
    const ext  = file.name.split('.').pop();
    const path = `${user!.id}/rooms/${roomId}.${ext}`;
    const { error } = await supabase.storage
      .from('object-images')
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('object-images').getPublicUrl(path);
    return data.publicUrl;
  }

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
      }).select().single();

      if (error) throw error;

      let imageUrl = '';
      if (imageFile && data) {
        imageUrl = await uploadRoomImage(imageFile, data.id);
        await supabase.from('rooms').update({ image_url: imageUrl }).eq('id', data.id);
      }

      showNotification('Room Added', `"${roomName}" has been added successfully.`, 'success', false);
      setRoomName(''); setFloor('Ground Floor'); setDescription('');
      setImageFile(null); setImagePreview(''); setShowForm(false);
      loadRooms();
    } catch {
      showNotification('Error', 'Failed to add room. Please try again.', 'error', false);
    }
    setSaving(false);
  }

  async function handleDeleteRoom(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This won't affect your registered objects.`)) return;
    await supabase.from('rooms').delete().eq('id', id);
    showNotification('Room Deleted', `"${name}" has been removed.`, 'info', false);
    loadRooms();
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>, room: Room) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingId(room.id);
    try {
      const url = await uploadRoomImage(file, room.id);
      await supabase.from('rooms').update({ image_url: url }).eq('id', room.id);
      loadRooms();
    } catch {
      showNotification('Error', 'Failed to upload photo.', 'error', false);
    }
    setUploadingId(null);
  }

  // Group rooms by floor
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
              {/* Room name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Room Name *
                </label>
                <input
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  placeholder="e.g. Living Room, Study, Master Bedroom"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Floor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Floor / Level
                </label>
                <select
                  value={floor}
                  onChange={e => setFloor(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {FLOOR_OPTIONS.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Description <span className="text-gray-400">(optional)</span>
              </label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Room next to kitchen, has blue sofa"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Photo upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Room Photo <span className="text-gray-400">(recommended — helps identify the room)</span>
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-2xl overflow-hidden hover:border-blue-400 transition-colors"
              >
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="preview" className="w-full h-40 object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <Upload className="w-8 h-8 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center gap-2 text-gray-400">
                    <Image className="w-8 h-8" />
                    <p className="text-sm">Click to upload a photo of this room</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save Room'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}

      {/* Empty state */}
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
            {floorRooms.map(room => (
              <div key={room.id} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden group">
                {/* Room photo */}
                <div className="relative h-40 bg-gray-100 dark:bg-gray-700">
                  {room.image_url ? (
                    <img src={room.image_url} alt={room.room_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300 dark:text-gray-600">
                      <Home className="w-12 h-12" />
                      <p className="text-xs">No photo</p>
                    </div>
                  )}

                  {/* Upload photo overlay */}
                  <label className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-all flex items-center justify-center opacity-0 hover:opacity-100 cursor-pointer">
                    <div className="flex flex-col items-center gap-1 text-white">
                      {uploadingId === room.id
                        ? <Loader2 className="w-7 h-7 animate-spin" />
                        : <Upload className="w-7 h-7" />}
                      <span className="text-xs font-medium">{room.image_url ? 'Change Photo' : 'Add Photo'}</span>
                    </div>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => handlePhotoUpload(e, room)} />
                  </label>

                  {/* Floor badge */}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg flex items-center gap-1">
                    <Layers className="w-3 h-3 text-white" />
                    <span className="text-xs text-white font-medium">{room.floor}</span>
                  </div>
                </div>

                {/* Room info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white truncate">{room.room_name}</h3>
                      {room.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{room.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteRoom(room.id, room.room_name)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Use this name when setting object locations</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* How to use */}
      {rooms.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
          <p className="text-sm text-blue-800 dark:text-blue-400">
            💡 <strong>How to use:</strong> When registering an object, set its <em>usual location</em> to a room name from this list
            (e.g. "Living Room", "Study"). When the camera detects it elsewhere, it will show a red alert saying
            which room it was supposed to be in. On the camera page, select the current room before scanning.
          </p>
        </div>
      )}
    </div>
  );
}