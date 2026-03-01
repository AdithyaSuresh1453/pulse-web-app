import { useState, useEffect } from 'react';
import { User, Mic, Bell, Shield, Save, Fingerprint, Bluetooth } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { VoiceLock } from '../../components/VoiceLock';
import { useNavigate } from 'react-router-dom';

export function Settings() {
  const { user, registerWebAuthn } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState({
    voice_assistant_enabled: true,
    camera_detection_enabled: false,
    notification_sound_enabled: true,
    alert_sensitivity: 'medium',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showVoiceLock, setShowVoiceLock] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setPreferences({
        voice_assistant_enabled: data.voice_assistant_enabled ?? true,
        camera_detection_enabled: data.camera_detection_enabled ?? false,
        notification_sound_enabled: data.notification_sound_enabled ?? true,
        alert_sensitivity: data.alert_sensitivity ?? 'medium',
      });
    } else {
      // No row yet — create one with defaults
      const defaults = {
        user_id: user.id,
        voice_assistant_enabled: true,
        camera_detection_enabled: false,
        notification_sound_enabled: true,
        alert_sensitivity: 'medium',
      };
      await supabase.from('user_preferences').upsert(defaults, { onConflict: 'user_id' });
    }

    setLoading(false);
  };

  const savePreferences = async () => {
    if (!user) return;

    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, ...preferences }, { onConflict: 'user_id' });

    if (error) {
      setMessage('Failed to save settings');
    } else {
      setMessage('Settings saved successfully');
    }

    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const setupWebAuthn = async () => {
    const { error } = await registerWebAuthn();
    if (error) {
      setMessage(`WebAuthn setup failed: ${error.message}`);
    } else {
      setMessage('WebAuthn registered successfully');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account and preferences
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl ${message.includes('success') ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
          <p className={`text-sm ${message.includes('success') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {message}
          </p>
        </div>
      )}

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Account Information
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl text-gray-900 dark:text-white cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              User ID
            </label>
            <input
              type="text"
              value={user?.id || ''}
              disabled
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl text-gray-900 dark:text-white cursor-not-allowed font-mono text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Security & Authentication
          </h2>
        </div>

        <div className="space-y-3">
          <button
            onClick={setupWebAuthn}
            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Fingerprint className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Set Up Fingerprint / Windows Hello
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Add biometric authentication
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowVoiceLock(true)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Mic className="w-5 h-5 text-pink-600 dark:text-pink-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Configure Voice Lock
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Set up or update voice passphrase
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Preferences
          </h2>
        </div>

        <div className="space-y-4">
          {[
            { label: 'Voice Assistant', desc: 'Enable voice commands and announcements', key: 'voice_assistant_enabled' as const },
            { label: 'Auto Camera Detection', desc: 'Automatically start camera detection on dashboard load', key: 'camera_detection_enabled' as const },
            { label: 'Notification Sounds', desc: 'Play sound for alerts and notifications', key: 'notification_sound_enabled' as const },
          ].map(({ label, desc, key }) => (
            <div
              key={key}
              onClick={() => {
                const updated = { ...preferences, [key]: !preferences[key] };
                setPreferences(updated);
                supabase.from('user_preferences').upsert(
                  { user_id: user!.id, ...updated },
                  { onConflict: 'user_id' }
                );
              }}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{desc}</p>
              </div>
              {/* Toggle pill */}
              <div className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${preferences[key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${preferences[key] ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
            </div>
          ))}

          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
              Alert Sensitivity
            </label>
            <select
              value={preferences.alert_sensitivity}
              onChange={(e) =>
                setPreferences({ ...preferences, alert_sensitivity: e.target.value })
              }
              className="w-full px-4 py-2 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors text-gray-900 dark:text-white"
            >
              <option value="low">Low - Only critical alerts</option>
              <option value="medium">Medium - Balanced notifications</option>
              <option value="high">High - All detections</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <Bluetooth className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Bluetooth & Device Alerts
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Send alerts to paired Bluetooth devices (smartwatches, earbuds) when unusual activity or forgotten phone is detected.
        </p>
        <button
          onClick={() => navigate('/dashboard/bluetooth')}
          className="w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-800"
        >
          <div className="flex items-center gap-3">
            <Bluetooth className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Manage Device Connections
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Pair or remove Bluetooth devices and configure per-device alerts
              </p>
            </div>
          </div>
          <span className="text-blue-600 dark:text-blue-400 text-lg">→</span>
        </button>
      </div>

      <button
        onClick={savePreferences}
        disabled={saving}
        className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Save className="w-5 h-5" />
        {saving ? 'Saving...' : 'Save Changes'}
      </button>

      {showVoiceLock && (
        <VoiceLock
          mode="register"
          onSuccess={() => {
            setShowVoiceLock(false);
            setMessage('Voice passphrase updated successfully');
            setTimeout(() => setMessage(''), 3000);
          }}
          onCancel={() => setShowVoiceLock(false)}
        />
      )}
    </div>
  );
}