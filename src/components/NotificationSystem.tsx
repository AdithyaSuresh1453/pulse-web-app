import { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  title: string;
}

export function NotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    const handleNotification = (event: Event) => {
      const e = event as CustomEvent;
      const notification: Notification = {
        id: `${Date.now()}-${Math.random()}`,
        type: e.detail.type ?? 'info',
        title: e.detail.title ?? '',
        message: e.detail.message ?? '',
      };

      setNotifications((prev) => [...prev, notification]);

      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      }, 5000);
    };

    window.addEventListener('pulse-notification', handleNotification);
    return () => window.removeEventListener('pulse-notification', handleNotification);
  }, []);

  if (notifications.length === 0) return null;

  const icons = {
    success: <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-500" />,
    error:   <AlertCircle  className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500"   />,
    warning: <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-yellow-500" />,
    info:    <Info          className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500"  />,
  };

  const styles = {
    success: 'bg-white dark:bg-gray-800 border-green-400 shadow-green-100 dark:shadow-green-900/20',
    error:   'bg-white dark:bg-gray-800 border-red-400   shadow-red-100   dark:shadow-red-900/20',
    warning: 'bg-white dark:bg-gray-800 border-yellow-400 shadow-yellow-100 dark:shadow-yellow-900/20',
    info:    'bg-white dark:bg-gray-800 border-blue-400  shadow-blue-100  dark:shadow-blue-900/20',
  };

  return (
    <>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(100%); }
          to   { opacity: 1; transform: translateX(0);    }
        }
        .toast-animate { animation: toast-in 0.3s ease forwards; }
      `}</style>
      <div
        style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 99999 }}
        className="flex flex-col gap-3 max-w-sm w-full pointer-events-none"
      >
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`toast-animate pointer-events-auto border-2 rounded-2xl p-4 shadow-xl flex items-start gap-3 ${styles[n.type]}`}
          >
            {icons[n.type]}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{n.title}</p>
              {n.message && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{n.message}</p>
              )}
            </div>
            <button
              onClick={() => removeNotification(n.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export function showNotification(
  title: string,
  message: string,
  type: 'info' | 'warning' | 'error' | 'success' = 'info',
  _sound = true
) {
  window.dispatchEvent(
    new CustomEvent('pulse-notification', {
      detail: { title, message, type },
    })
  );
}