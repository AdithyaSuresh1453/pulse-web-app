import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Plus, Camera, Bell,
  Smartphone, Settings, LogOut, Menu, X, Sun, Moon, Clock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Logo } from './Logo';
import { supabase } from '../lib/supabase';

interface DashboardLayoutProps { children: React.ReactNode; }

interface NotifItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  time: Date;
  read: boolean;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Overview',               path: '/dashboard' },
  { icon: Package,         label: 'Registered Objects',     path: '/dashboard/objects' },
  { icon: Plus,            label: 'Add Object',             path: '/dashboard/add-object' },
  { icon: Camera,          label: 'Live Camera Detection',  path: '/dashboard/camera' },
  { icon: Bell,            label: 'Alerts & History',       path: '/dashboard/alerts' },
  { icon: Smartphone,      label: 'Phone Recovery',         path: '/dashboard/phone-recovery' },
  { icon: Settings,        label: 'Settings',               path: '/dashboard/settings' },
];

function timeAgo(date: Date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return date.toLocaleDateString();
}

const typeColors: Record<string, string> = {
  success: 'bg-green-500',
  error:   'bg-red-500',
  warning: 'bg-yellow-500',
  info:    'bg-blue-500',
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [bellOpen,    setBellOpen]      = useState(false);
  const [notifs,      setNotifs]        = useState<NotifItem[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);

  // Listen for toast events and mirror them into the bell dropdown
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent;
      setNotifs(prev => [{
        id:      `${Date.now()}-${Math.random()}`,
        title:   ev.detail.title   ?? 'Notification',
        message: ev.detail.message ?? '',
        type:    ev.detail.type    ?? 'info',
        time:    new Date(),
        read:    false,
      }, ...prev].slice(0, 20)); // keep last 20
    };
    window.addEventListener('pulse-notification', handler);
    return () => window.removeEventListener('pulse-notification', handler);
  }, []);

  // Also pull recent DB alerts for the badge count
  useEffect(() => {
    if (!user) return;
    const fetchAlerts = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('activity_logs').select('id, activity_type, location, created_at')
        .eq('user_id', user.id)
        .in('activity_type', ['unusual_activity', 'missing'])
        .gte('created_at', since)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const dbNotifs: NotifItem[] = data.map(d => ({
          id:      d.id,
          title:   d.activity_type === 'missing' ? '⚠️ Object Missing' : '🚨 Unusual Activity',
          message: d.location ? `Location: ${d.location}` : '',
          type:    'warning' as const,
          time:    new Date(d.created_at),
          read:    false,
        }));
        setNotifs(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const fresh = dbNotifs.filter(n => !existingIds.has(n.id));
          return [...fresh, ...prev].slice(0, 20);
        });
      }
    };
    fetchAlerts();
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifs.filter(n => !n.read).length;

  const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  const clearAll    = () => setNotifs([]);

  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  // Bell button (reused in both mobile and desktop bars)
  const BellButton = () => (
    <div ref={bellRef} className="relative">
      <button
        onClick={() => { setBellOpen(o => !o); if (!bellOpen) markAllRead(); }}
        className="relative p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {bellOpen && (
        <div className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">Notifications</span>
            <div className="flex gap-2">
              {notifs.length > 0 && (
                <button onClick={clearAll} className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors">
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Bell className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0 ${
                    n.read ? 'opacity-60' : ''
                  }`}
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${typeColors[n.type]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{n.title}</p>
                    {n.message && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{n.message}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400 dark:text-gray-500">
                      <Clock className="w-3 h-3" />
                      {timeAgo(n.time)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
              <Link
                to="/dashboard/alerts"
                onClick={() => setBellOpen(false)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                View all alerts →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">

      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <Logo size={32} showText={true} />
          <div className="flex items-center gap-2">
            <BellButton />
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {sidebarOpen
                ? <X    className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                : <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Desktop top bar (right side only) ── */}
      <div className="hidden lg:flex fixed top-0 left-72 right-0 z-40 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700 px-6 py-3 items-center justify-end gap-3">
        <BellButton />
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark'
            ? <Sun  className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            : <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          }
        </button>
        <div className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{user?.email}</p>
        </div>
      </div>

      {/* ── Sidebar ── */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border-r border-gray-200 dark:border-gray-700 p-6 transition-transform duration-300 z-40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="hidden lg:block mb-8">
          <Logo size={40} showText={true} />
        </div>

        <nav className="space-y-2 mt-20 lg:mt-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {item.path === '/dashboard/alerts' && unread > 0 && (
                  <span className="ml-auto w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-6 left-6 right-6 space-y-3">
          {/* Theme toggle only shows in sidebar on mobile; desktop uses top bar */}
          <button
            onClick={toggleTheme}
            className="lg:hidden w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>

          <div className="px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-700/50">
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="lg:ml-72 pt-20 lg:pt-16 p-6">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}