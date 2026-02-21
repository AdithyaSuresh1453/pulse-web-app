import { useEffect, useState } from 'react';
import { Package, Search, Edit2, Trash2, MapPin, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ObjectType {
  id: string;
  object_id: string;
  object_name: string;
  usual_location: string;
  last_known_location: string;
  last_detected_time: string | null;
  image_url: string;
  created_at: string;
}

export function RegisteredObjects() {
  const { user } = useAuth();
  const [objects, setObjects] = useState<ObjectType[]>([]);
  const [filteredObjects, setFilteredObjects] = useState<ObjectType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadObjects();
  }, [user]);

  useEffect(() => {
    if (searchQuery) {
      setFilteredObjects(
        objects.filter(
          (obj) =>
            obj.object_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            obj.usual_location.toLowerCase().includes(searchQuery.toLowerCase())
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
      setObjects(objects.filter((obj) => obj.id !== id));
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Registered Objects
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your tracked belongings
          </p>
        </div>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or location..."
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
            {filteredObjects.map((obj) => (
              <div
                key={obj.id}
                className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-5 hover:shadow-lg transition-shadow"
              >
                {obj.image_url ? (
                  <img
                    src={obj.image_url}
                    alt={obj.object_name}
                    className="w-full h-40 object-cover rounded-xl mb-4"
                  />
                ) : (
                  <div className="w-full h-40 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl mb-4 flex items-center justify-center">
                    <Package className="w-16 h-16 text-white opacity-50" />
                  </div>
                )}

                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {obj.object_name}
                </h3>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <MapPin className="w-4 h-4" />
                    <span>Usual: {obj.usual_location || 'Not set'}</span>
                  </div>

                  {obj.last_known_location && (
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <MapPin className="w-4 h-4" />
                      <span>Last seen: {obj.last_known_location}</span>
                    </div>
                  )}

                  {obj.last_detected_time && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(obj.last_detected_time).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteId(obj.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Delete Object?
            </h2>
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
      )}
    </div>
  );
}
