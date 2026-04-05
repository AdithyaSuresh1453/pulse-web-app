import { useEffect, useState } from 'react';
import {
  Package, Search, Trash2, MapPin, Clock,
  ChevronLeft, ChevronRight, X, AlignLeft,
  Navigation, Pencil, Save
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { showNotification } from '../../components/NotificationSystem';
import { useAuth } from '../../contexts/AuthContext';

interface ObjectType {
  id: string;
  object_id: string;
  object_name: string;
  description: string;
  usual_location: string;
  secondary_location: string;
  last_known_location: string;
  last_detected_time: string | null;
  image_url: string;
  image_urls: string[];
  image_labels: string[];
  created_at: string;
  is_wearable: boolean;
}

interface Room {
  id: string;
  room_name: string;
  latitude: number | null;
  longitude: number | null;
}

interface EditForm {
  object_name: string;
  description: string;
  usual_location: string;
  secondary_location: string;
  last_known_location: string;
  is_wearable: boolean;
}

function ImageGallery({ urls, labels }: { urls: string[]; labels?: string[] }) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (!urls || urls.length === 0) return null;

  return (
    <>
      <div
        className="relative w-full h-44 rounded-xl overflow-hidden mb-4 group cursor-pointer"
        onClick={() => setLightbox(true)}
      >
        <img
          src={urls[idx]}
          alt={labels?.[idx] ?? 'photo'}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {labels?.[idx] && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded-lg">
            {labels[idx]}
          </div>
        )}
        {urls.length > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); setIdx(prev => Math.max(0, prev - 1)); }}
              disabled={idx === 0}
              className="absolute left-1 top-1/2 -translate-y-1/2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-20"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); setIdx(prev => Math.min(urls.length - 1, prev + 1)); }}
              disabled={idx === urls.length - 1}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-20"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded-lg">
              {idx + 1}/{urls.length}
            </div>
          </>
        )}
      </div>

      {urls.length > 1 && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          {urls.map((url, n) => (
            <img
              key={url}
              src={url}
              alt=""
              onClick={() => setIdx(n)}
              className={`w-10 h-10 object-cover rounded-lg cursor-pointer shrink-0 transition-all ${
                n === idx ? 'ring-2 ring-blue-500 opacity-100' : 'opacity-60 hover:opacity-90'
              }`}
            />
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/30"
            onClick={() => setLightbox(false)}
          >
            <X className="w-5 h-5" />
          </button>

          <button
            className="absolute left-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/30 disabled:opacity-20"
            disabled={idx === 0}
            onClick={e => { e.stopPropagation(); setIdx(prev => Math.max(0, prev - 1)); }}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div onClick={e => e.stopPropagation()} className="flex flex-col items-center gap-3">
            <img
              src={urls[idx]}
              alt=""
              className="max-w-full max-h-[75vh] rounded-2xl object-contain"
            />
            {labels?.[idx] && (
              <span className="px-3 py-1 bg-white/20 text-white text-sm rounded-full">
                {labels[idx]}
              </span>
            )}
            <div className="flex gap-2">
              {urls.map((_, n) => (
                <button
                  key={n}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    n === idx ? 'bg-white' : 'bg-white/40'
                  }`}
                  onClick={e => { e.stopPropagation(); setIdx(n); }}
                />
              ))}
            </div>
          </div>

          <button
            className="absolute right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/30 disabled:opacity-20"
            disabled={idx === urls.length - 1}
            onClick={e => { e.stopPropagation(); setIdx(prev => Math.min(urls.length - 1, prev + 1)); }}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}
    </>
  );
}

export function RegisteredObjects() {
  const { user } = useAuth();
  const [objects, setObjects] = useState<ObjectType[]>([]);
  const [filteredObjects, setFilteredObjects] = useState<ObjectType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [editObj, setEditObj] = useState<ObjectType | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    object_name: '',
    description: '',
    usual_location: '',
    secondary_location: '',
    last_known_location: '',
    is_wearable: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('rooms')
      .select('id, room_name, latitude, longitude')
      .eq('user_id', user.id)
      .then(({ data }) => { if (data) setRooms(data as Room[]); });
  }, [user]);

  useEffect(() => { loadObjects(); }, [user]);

  useEffect(() => {
    if (searchQuery) {
      setFilteredObjects(
        objects.filter(obj =>
          obj.object_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          obj.usual_location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          obj.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredObjects(objects);
    }
  }, [searchQuery, objects]);

  const loadObjects = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('objects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setObjects(data || []);
    setFilteredObjects(data || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('objects').delete().eq('id', id);
    if (!error) {
      const deleted = objects.find(o => o.id === id);
      setObjects(prev => prev.filter(obj => obj.id !== id));
      setFilteredObjects(prev => prev.filter(obj => obj.id !== id));
      setDeleteId(null);
      showNotification('Object Deleted', `${deleted?.object_name || 'Object'} has been removed.`, 'info');
    } else {
      showNotification('Delete Failed', 'Could not delete the object. Try again.', 'error');
    }
  };

  const openEdit = (obj: ObjectType) => {
    setEditObj(obj);
    setEditForm({
      object_name: obj.object_name ?? '',
      description: obj.description ?? '',
      usual_location: obj.usual_location ?? '',
      secondary_location: obj.secondary_location ?? '',
      last_known_location: obj.last_known_location ?? '',
      is_wearable: obj.is_wearable ?? false,
    });
  };

  const handleSave = async () => {
    if (!editObj) return;
    if (!editForm.object_name.trim()) {
      showNotification('Validation Error', 'Object name cannot be empty.', 'error');
      return;
    }
    setIsSaving(true);
    const { error } = await supabase
      .from('objects')
      .update({
        object_name: editForm.object_name.trim(),
        description: editForm.description.trim(),
        usual_location: editForm.usual_location.trim(),
        secondary_location: editForm.secondary_location.trim(),
        last_known_location: editForm.last_known_location.trim(),
        is_wearable: editForm.is_wearable,
      })
      .eq('id', editObj.id);
    setIsSaving(false);
    if (error) {
      showNotification('Save Failed', 'Could not update the object. Try again.', 'error');
      return;
    }
    setObjects(prev => prev.map(o => o.id === editObj.id ? { ...o, ...editForm } : o));
    setEditObj(null);
    showNotification('Object Updated', `${editForm.object_name} has been updated.`, 'success');
  };

  const getDirectionsUrl = (locationName: string): string | null => {
    if (!locationName) return null;
    const room = rooms.find(r => r.room_name.toLowerCase() === locationName.toLowerCase());
    if (room?.latitude && room?.longitude) {
      const dest = `${room.latitude},${room.longitude}`;
      const origin = userLocation ? `${userLocation.lat},${userLocation.lng}` : '';
      return origin
        ? `https://www.google.com/maps/dir/${origin}/${dest}`
        : `https://www.google.com/maps/dir//${dest}`;
    }
    const query = encodeURIComponent(locationName);
    const origin = userLocation ? `${userLocation.lat},${userLocation.lng}` : '';
    return origin
      ? `https://www.google.com/maps/dir/${origin}/${query}`
      : `https://www.google.com/maps/search/${query}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Registered Objects</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your tracked belongings</p>
        </div>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, location, or description..."
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors text-gray-900 dark:text-white"
          />
        </div>

        {filteredObjects.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery ? 'No objects found' : 'No registered objects yet'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              {searchQuery ? 'Try a different search term' : 'Add your first object to start tracking'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredObjects.map(obj => {
              const allUrls: string[] = obj.image_urls?.length
                ? obj.image_urls
                : obj.image_url
                ? [obj.image_url]
                : [];
              const labels: string[] = obj.image_labels ?? [];
              const directionsUrl = getDirectionsUrl(obj.last_known_location);

              return (
                <div
                  key={obj.id}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-5 hover:shadow-lg transition-shadow flex flex-col"
                >
                  {allUrls.length > 0 ? (
                    <ImageGallery urls={allUrls} labels={labels} />
                  ) : (
                    <div className="w-full h-44 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl mb-4 flex items-center justify-center">
                      <Package className="w-16 h-16 text-white opacity-50" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {obj.object_name}
                    </h3>
                    {obj.is_wearable ? (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full border border-blue-200 dark:border-blue-800">
                        👤 Wearable
                      </span>
                    ) : null}
                  </div>

                  {obj.description ? (
                    <div className="flex items-start gap-2 mb-3 p-2.5 bg-white dark:bg-gray-800 rounded-xl">
                      <AlignLeft className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        {obj.description}
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-2 mb-4 flex-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span>Usual: {obj.usual_location || 'Not set'}</span>
                    </div>
                    {obj.secondary_location ? (
                      <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span>Secondary: {obj.secondary_location}</span>
                      </div>
                    ) : null}
                    {obj.last_known_location ? (
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span>Last seen: {obj.last_known_location}</span>
                      </div>
                    ) : null}
                    {obj.last_detected_time ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>{new Date(obj.last_detected_time).toLocaleString()}</span>
                      </div>
                    ) : null}
                    {obj.is_wearable ? (
                      <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-2 py-1.5">
                        <span>✓ Location alerts disabled — always on person</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    {directionsUrl !== null ? (
                      <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <Navigation className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          Get Directions to {obj.last_known_location}
                        </span>
                      </a>
                    ) : null}

                    <button
                      onClick={() => openEdit(obj)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-xl hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      <span className="text-sm font-medium">Edit</span>
                    </button>

                    <button
                      onClick={() => setDeleteId(obj.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editObj !== null ? (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Object</h2>
              <button
                onClick={() => setEditObj(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Object Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.object_name}
                  onChange={e => setEditForm(f => ({ ...f, object_name: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white"
                  placeholder="e.g. Car Keys"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white resize-none"
                  placeholder="Describe the object..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Usual Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={editForm.usual_location}
                    onChange={e => setEditForm(f => ({ ...f, usual_location: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white"
                    placeholder="e.g. Living Room"
                    list="rooms-list"
                  />
                  <datalist id="rooms-list">
                    {rooms.map(r => (
                      <option key={r.id} value={r.room_name} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Secondary Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                  <input
                    type="text"
                    value={editForm.secondary_location}
                    onChange={e => setEditForm(f => ({ ...f, secondary_location: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white"
                    placeholder="e.g. Kitchen Counter"
                    list="rooms-list"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Known Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                  <input
                    type="text"
                    value={editForm.last_known_location}
                    onChange={e => setEditForm(f => ({ ...f, last_known_location: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white"
                    placeholder="e.g. Bedroom"
                    list="rooms-list"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    👤 Wearable / Always on person
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Watch, ring, keys etc. — skips all location alerts
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditForm(f => ({ ...f, is_wearable: !f.is_wearable }))}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                    editForm.is_wearable ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                      editForm.is_wearable ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setEditObj(null)}
                className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      ) : null}

      {deleteId !== null ? (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Delete Object?</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This action cannot be undone. All activity logs for this object will also be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-2xl font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}