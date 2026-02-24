import { useEffect, useState } from 'react';
import { Bell, Clock, MapPin, Filter, Trash2, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { showNotification } from '../../components/NotificationSystem';
import { useAuth } from '../../contexts/AuthContext';

interface ActivityLog {
  id: string;
  activity_type: string;
  location: string;
  confidence: number;
  created_at: string;
  metadata: Record<string, unknown>;
}

function timeAgo(dateStr: string) {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60)   return `${s} second${s !== 1 ? 's' : ''} ago`;
  if (s < 3600)  return `${Math.floor(s / 60)} minute${Math.floor(s / 60) !== 1 ? 's' : ''} ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hour${Math.floor(s / 3600) !== 1 ? 's' : ''} ago`;
  const d = Math.floor(s / 86400);
  return `${d} day${d !== 1 ? 's' : ''} ago`;
}

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const typeConfig: Record<string, { label: string; icon: typeof Bell; style: string; dot: string }> = {
  detected: {
    label: 'Detected',
    icon: CheckCircle,
    style: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400',
    dot: 'bg-green-500',
  },
  registered: {
    label: 'Registered',
    icon: Info,
    style: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  missing: {
    label: 'Missing',
    icon: AlertCircle,
    style: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
  },
  unusual_activity: {
    label: 'Unusual Activity',
    icon: AlertTriangle,
    style: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400',
    dot: 'bg-yellow-500',
  },
};

const fallbackConfig = {
  label: 'Activity',
  icon: Bell,
  style: 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-400',
  dot: 'bg-gray-400',
};

export function AlertsHistory() {
  const { user } = useAuth();
  const [logs,         setLogs]         = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [filter,       setFilter]       = useState<string>('all');
  const [loading,      setLoading]      = useState(true);
  const [now,          setNow]          = useState(Date.now());

  // Tick every 30s so relative times stay fresh
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  // suppress unused warning
  void now;

  useEffect(() => { loadLogs(); }, [user]);

  useEffect(() => {
    setFilteredLogs(filter === 'all' ? logs : logs.filter(l => l.activity_type === filter));
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
    if (!confirm('Clear all activity history?')) return;
    await supabase.from('activity_logs').delete().eq('user_id', user.id);
    setLogs([]);
    setFilteredLogs([]);
    showNotification('Alerts Cleared', 'All activity logs have been cleared.', 'info');
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Alerts & History</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {logs.length} total event{logs.length !== 1 ? 's' : ''}
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
        {/* Filter */}
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
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
          {filteredLogs.length !== logs.length && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {filteredLogs.length} result{filteredLogs.length !== 1 ? 's' : ''}
            </span>
          )}
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
            {filteredLogs.map((log) => {
              const cfg = typeConfig[log.activity_type] ?? fallbackConfig;
              const Icon = cfg.icon;
              return (
                <div key={log.id} className={`border rounded-2xl p-4 ${cfg.style}`}>
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{cfg.label}</span>
                        {log.confidence > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-white/50 dark:bg-black/20 rounded-lg">
                            {Math.round(log.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>

                      {/* Location */}
                      {log.location && (
                        <div className="flex items-center gap-1.5 text-xs mt-1.5 opacity-80">
                          <MapPin className="w-3 h-3" />
                          <span>{log.location}</span>
                        </div>
                      )}

                      {/* Metadata */}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="text-xs mt-1 opacity-70">
                          {Object.entries(log.metadata).map(([k, v]) => (
                            <span key={k} className="mr-2">
                              <span className="font-medium">{k}:</span> {String(v)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Time row */}
                      <div className="flex items-center gap-3 mt-2 text-xs opacity-70">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeAgo(log.created_at)}
                        </span>
                        <span className="opacity-60">·</span>
                        <span>{formatFullDate(log.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}