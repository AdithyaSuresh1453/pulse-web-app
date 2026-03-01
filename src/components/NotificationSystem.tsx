import { useEffect, useState, useRef, createContext, useContext, useCallback } from 'react';
import { X, AlertCircle, Bell, CheckCheck, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useBluetoothDevices } from '../hooks/useBluetoothDevices';

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  title: string;
  read: boolean;
  timestamp: Date;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  removeNotification: () => {},
  clearAll: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

// ─── Icon per type ────────────────────────────────────────────────────────────

function NotifIcon({ type, className }: { type: Notification['type']; className?: string }) {
  switch (type) {
    case 'error':   return <AlertCircle className={className} />;
    case 'warning': return <AlertTriangle className={className} />;
    case 'success': return <CheckCircle2 className={className} />;
    default:        return <Info className={className} />;
  }
}

function typeStyles(type: Notification['type']) {
  switch (type) {
    case 'error':   return { badge: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',   icon: 'text-red-500',    dot: 'bg-red-500' };
    case 'warning': return { badge: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800', icon: 'text-yellow-500', dot: 'bg-yellow-500' };
    case 'success': return { badge: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',  icon: 'text-green-500',  dot: 'bg-green-500' };
    default:        return { badge: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',   icon: 'text-blue-500',   dot: 'bg-blue-500' };
  }
}

// ─── Dropdown panel ───────────────────────────────────────────────────────────

function NotificationPanel({
  notifications,
  unreadCount,
  onMarkAllRead,
  onRemove,
  onClearAll,
  onClose,
}: {
  notifications: Notification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="font-semibold text-sm text-gray-900 dark:text-white">Notifications</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={onClearAll}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs text-gray-500 dark:text-gray-400 font-medium"
            >
              Clear all
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Bell className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">All caught up!</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => {
            const styles = typeStyles(n.type);
            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0 ${
                  !n.read ? 'bg-gray-50/80 dark:bg-gray-700/20' : ''
                }`}
              >
                <NotifIcon type={n.type} className={`w-4 h-4 mt-0.5 shrink-0 ${styles.icon}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{n.title}</p>
                    {!n.read && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    {n.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button
                  onClick={() => onRemove(n.id)}
                  className="shrink-0 p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors mt-0.5"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Bell button — import this into DashboardLayout ──────────────────────────

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, removeNotification, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleOpen = () => {
    setOpen((prev) => !prev);
    if (!open) markAllRead();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllRead={markAllRead}
          onRemove={removeNotification}
          onClearAll={clearAll}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Provider — replaces old <NotificationSystem /> in App.tsx ────────────────

export function NotificationSystem({ children }: { children?: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { sendAlert } = useBluetoothDevices();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  useEffect(() => {
    const handleNotification = (event: CustomEvent) => {
      const notification: Notification = {
        id: Date.now().toString(),
        type: event.detail.type ?? 'info',
        title: event.detail.title ?? '',
        message: event.detail.message ?? '',
        read: false,
        timestamp: new Date(),
      };

      setNotifications((prev) => [notification, ...prev].slice(0, 50));

      if (notification.type === 'warning' || notification.type === 'error') {
        sendAlert(`${notification.title}: ${notification.message}`);
      }

      if (event.detail.sound) {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLUgjMGGGS578yKOgkVY7fq5KVXFA1Hn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFA==');
        audio.play().catch(() => {});
      }

      // Auto-dismiss toast after 5s by marking read
      setTimeout(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
      }, 5000);
    };

    window.addEventListener('pulse-notification' as keyof WindowEventMap, handleNotification as EventListener);
    return () => window.removeEventListener('pulse-notification' as keyof WindowEventMap, handleNotification as EventListener);
  }, [sendAlert]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, removeNotification, clearAll }}>
      {children}

      {/* Toast pop-ups — show newest unread ones at top right */}
      <div className="fixed top-16 right-4 z-[60] space-y-2 max-w-sm pointer-events-none">
        {notifications.filter((n) => !n.read).slice(0, 3).map((n) => {
          const styles = typeStyles(n.type);
          return (
            <div
              key={n.id}
              className={`pointer-events-auto border rounded-2xl p-4 shadow-lg backdrop-blur-xl flex items-start gap-3 ${styles.badge}`}
            >
              <NotifIcon type={n.type} className={`w-4 h-4 mt-0.5 shrink-0 ${styles.icon}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white">{n.title}</p>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{n.message}</p>
              </div>
              <button
                onClick={() => removeNotification(n.id)}
                className="shrink-0 hover:opacity-70 transition-opacity"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}

// ─── Helper to fire a notification from anywhere in the app ──────────────────

export function showNotification(
  title: string,
  message: string,
  type: 'info' | 'warning' | 'error' | 'success' = 'info',
  sound = true
) {
  window.dispatchEvent(new CustomEvent('pulse-notification', { detail: { title, message, type, sound } }));
}