import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { showNotification } from '../components/NotificationSystem';

function checkPassword(pw: string) {
  return [
    { label: 'At least 6 characters', pass: pw.length >= 6 },
    { label: 'Contains a letter',     pass: /[a-zA-Z]/.test(pw) },
    { label: 'Contains a number',     pass: /\d/.test(pw) },
  ];
}

export function ResetPassword() {
  const navigate = useNavigate();
  const [password,     setPassword]     = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [showPw,       setShowPw]       = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [done,         setDone]         = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checking,     setChecking]     = useState(true);

  useEffect(() => {
    const trySession = async () => {
      // Supabase can send tokens in the hash OR as query params depending on config
      // Check hash first: #access_token=...&type=recovery
      const hash = window.location.hash;
      const query = window.location.search;

      let accessToken  = '';
      let refreshToken = '';
      let type         = '';

      if (hash && hash.length > 1) {
        const params = new URLSearchParams(hash.substring(1));
        accessToken  = params.get('access_token')  ?? '';
        refreshToken = params.get('refresh_token') ?? '';
        type         = params.get('type')          ?? '';
      }

      // Fallback: check query string ?access_token=...&type=recovery
      if (!accessToken && query) {
        const params = new URLSearchParams(query);
        accessToken  = params.get('access_token')  ?? '';
        refreshToken = params.get('refresh_token') ?? '';
        type         = params.get('type')          ?? '';
      }

      // Fallback: Supabase PKCE flow sends ?code= instead
      if (!accessToken && query) {
        const params  = new URLSearchParams(query);
        const code    = params.get('code') ?? '';
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) { setValidSession(true); setChecking(false); return; }
        }
      }

      if (accessToken && type === 'recovery') {
        const { error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          setError('This reset link has expired or already been used. Please request a new one.');
        } else {
          setValidSession(true);
        }
      } else if (accessToken && !type) {
        // Some Supabase configs omit type — try setting the session anyway
        const { error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        });
        if (!error) { setValidSession(true); setChecking(false); return; }
        setError('Invalid reset link. Please request a new one.');
      } else {
        // Last resort — check if there's already an active session from the link click
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setValidSession(true);
        } else {
          setError('Invalid reset link. Please request a new one.');
        }
      }
      setChecking(false);
    };

    trySession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setError('');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      showNotification('Reset Failed', error.message, 'error');
    } else {
      setDone(true);
      showNotification('Password Updated', 'Your password has been reset successfully.', 'success');
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login'), 3000);
    }
  };

  const checks  = checkPassword(password);
  const allPass = checks.every(c => c.pass);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 dark:border-gray-700/20">
          <div className="flex justify-center mb-8">
            <Logo size={50} showText={true} />
          </div>

          {checking ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Verifying reset link...</p>
            </div>

          ) : done ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Password Reset!</h2>
              <p className="text-gray-600 dark:text-gray-400">Your password has been updated successfully.</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting to sign in...</p>
            </div>

          ) : !validSession ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Link Expired</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
              <button onClick={() => navigate('/login')}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-2xl hover:from-blue-700 hover:to-blue-800 transition-all">
                Back to Sign In
              </button>
            </div>

          ) : (
            <>
              <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">Set New Password</h1>
              <p className="text-center text-gray-600 dark:text-gray-400 mb-8 text-sm">Choose a strong password for your account</p>

              {error && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors text-gray-900 dark:text-white"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {checks.map(c => (
                        <div key={c.label} className="flex items-center gap-2">
                          {c.pass
                            ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                            : <XCircle    className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />}
                          <span className={`text-xs ${c.pass ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      className={`w-full pl-12 pr-12 py-3 bg-white dark:bg-gray-700 border-2 rounded-2xl focus:outline-none transition-colors text-gray-900 dark:text-white ${
                        confirm && confirm === password
                          ? 'border-green-400 dark:border-green-500'
                          : confirm
                          ? 'border-red-400 dark:border-red-500'
                          : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400'
                      }`}
                      placeholder="••••••••"
                    />
                    {confirm && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2">
                        {confirm === password
                          ? <CheckCircle className="w-5 h-5 text-green-500" />
                          : <XCircle    className="w-5 h-5 text-red-400" />}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !allPass || password !== confirm}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
