import { useEffect, useState } from 'react';
import { Bell, Clock, MapPin, Filter, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ActivityLog {
  id: string;
  activity_type: string;
  location: string;
  confidence: number;
  created_at: string;
  metadata: Record<string, unknown>;
}

export function AlertsHistory() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [user]);

  useEffect(() => {
    if (filter === 'all') {
      setFilteredLogs(logs);
    } else {
      setFilteredLogs(logs.filter((log) => log.activity_type === filter));
    }
  }, [filter, logs]);

  const loadLogs = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setLogs(data || []);
    setFilteredLogs(data || []);
    setLoading(false);
  };

  const clearHistory = async () => {
    if (!user) return;
    if (!confirm('Are you sure you want to clear all activity history?')) return;

    await supabase.from('activity_logs').delete().eq('user_id', user.id);
    setLogs([]);
    setFilteredLogs([]);
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'detected':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400';
      case 'missing':
      case 'unusual_activity':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400';
      case 'registered':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400';
      default:
        return 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-400';
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
            Alerts & History
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View all activity logs and alerts
          </p>
        </div>
        <button
          onClick={clearHistory}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clear History
        </button>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors text-gray-900 dark:text-white"
          >
            <option value="all">All Activity</option>
            <option value="detected">Detected</option>
            <option value="registered">Registered</option>
            <option value="missing">Missing</option>
            <option value="unusual_activity">Unusual Activity</option>
          </select>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">No activity logs found</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Activity will appear here as you track objects
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`border rounded-2xl p-4 ${getActivityColor(log.activity_type)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Bell className="w-4 h-4" />
                      <h3 className="font-medium capitalize">
                        {log.activity_type.replace('_', ' ')}
                      </h3>
                      {log.confidence > 0 && (
                        <span className="text-xs px-2 py-1 bg-white/50 dark:bg-black/20 rounded-lg">
                          {Math.round(log.confidence * 100)}% confidence
                        </span>
                      )}
                    </div>

                    {log.location && (
                      <div className="flex items-center gap-2 text-sm mb-1">
                        <MapPin className="w-3 h-3" />
                        <span>{log.location}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs opacity-75">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                    </div>

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-2 text-xs opacity-75">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
