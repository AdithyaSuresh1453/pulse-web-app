import { useEffect, useState } from 'react';
import { Package, Activity, Bell, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Stats {
  totalObjects: number;
  recentDetections: number;
  activeAlerts: number;
  detectionRate: number;
}

export function Overview() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalObjects: 0,
    recentDetections: 0,
    activeAlerts: 0,
    detectionRate: 0,
  });
  const [recentActivity, setRecentActivity] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    const { data: objects } = await supabase
      .from('objects')
      .select('*')
      .eq('user_id', user.id);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentLogs } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });

    const { data: allLogs } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const activeAlerts = recentLogs?.filter((log: {activity_type: string}) =>
      log.activity_type === 'unusual_activity' || log.activity_type === 'missing'
    ).length || 0;

    setStats({
      totalObjects: objects?.length || 0,
      recentDetections: recentLogs?.length || 0,
      activeAlerts,
      detectionRate: objects?.length ? Math.round((recentLogs?.length || 0) / objects.length * 100) : 0,
    });

    setRecentActivity(allLogs || []);
    setLoading(false);
  };

  const statCards = [
    {
      icon: Package,
      label: 'Total Objects',
      value: stats.totalObjects,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      icon: Activity,
      label: 'Recent Detections',
      value: stats.recentDetections,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      iconColor: 'text-green-600 dark:text-green-400',
      subtitle: 'Last 24 hours',
    },
    {
      icon: Bell,
      label: 'Active Alerts',
      value: stats.activeAlerts,
      color: 'from-pink-500 to-pink-600',
      bgColor: 'bg-pink-50 dark:bg-pink-900/20',
      iconColor: 'text-pink-600 dark:text-pink-400',
    },
    {
      icon: TrendingUp,
      label: 'Detection Rate',
      value: `${stats.detectionRate}%`,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Dashboard Overview
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your belongings and monitor their activity
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className={`w-12 h-12 rounded-2xl ${card.bgColor} flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">{card.label}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{card.value}</p>
              {card.subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.subtitle}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h2>

        {recentActivity.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">No recent activity</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Start tracking objects to see activity here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((activity: {
              id: string;
              activity_type: string;
              location: string;
              created_at: string;
            }) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {activity.activity_type.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {activity.location || 'Unknown location'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(activity.created_at).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
