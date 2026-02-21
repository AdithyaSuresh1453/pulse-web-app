import { useEffect, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  title: string;
}

export function NotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const handleNotification = (event: CustomEvent) => {
      const notification: Notification = {
        id: Date.now().toString(),
        ...event.detail,
      };

      setNotifications((prev) => [...prev, notification]);

      if (event.detail.sound) {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLUgjMGGGS578yKOgkVY7fq5KVXFA1Hn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFAxHn+TyvmshBSuBzvLUgjMGGGS578yKOgkVY7fq5KNWFA==');
        audio.play();
      }

      setTimeout(() => {
        removeNotification(notification.id);
      }, 5000);
    };

    window.addEventListener('pulse-notification' as keyof WindowEventMap, handleNotification as EventListener);

    return () => {
      window.removeEventListener('pulse-notification' as keyof WindowEventMap, handleNotification as EventListener);
    };
  }, []);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400';
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-50 space-y-3 max-w-md">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`border-2 rounded-2xl p-4 shadow-lg backdrop-blur-xl animate-slide-in ${getNotificationStyles(
            notification.type
          )}`}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm mb-1">{notification.title}</h4>
              <p className="text-sm opacity-90">{notification.message}</p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 hover:opacity-70 transition-opacity"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function showNotification(
  title: string,
  message: string,
  type: 'info' | 'warning' | 'error' | 'success' = 'info',
  sound = true
) {
  const event = new CustomEvent('pulse-notification', {
    detail: { title, message, type, sound },
  });
  window.dispatchEvent(event);
}
