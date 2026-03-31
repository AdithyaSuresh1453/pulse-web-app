import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Fingerprint, Mic, Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import  Logo  from '../components/Logo';
import { VoiceLock } from '../components/VoiceLock';
import { supabase } from '../lib/supabase';
import { showNotification } from '../components/NotificationSystem';

// ── Validation helpers ────────────────────────────────────────────────────────
function validateEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required.';
  // Must have letters before @, not just numbers
  const localPart = trimmed.split('@')[0];
  if (!localPart) return 'Enter a valid email address.';
  if (/^\d+$/.test(localPart)) return 'Email cannot be only numbers before @.';
  // Must end with .com
  if (!trimmed.toLowerCase().endsWith('.com')) return 'Only .com email addresses are allowed.';
  // Basic email pattern
  const emailRegex = /^[a-zA-Z][a-zA-Z0-9._%+\-]*@[a-zA-Z0-9.\-]+\.com$/;
  if (!emailRegex.test(trimmed)) return 'Enter a valid email address (e.g. you@example.com).';
  return '';
}

function validatePassword(password: string): string {
  if (!password) return 'Password is required.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  return '';
}

export function Login() {
  const navigate = useNavigate();
  const { signIn, signInWithWebAuthn } = useAuth();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [emailErr,    setEmailErr]    = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [showVoice,   setShowVoice]   = useState(false);

  // Forgot-password state
  const [showForgot,       setShowForgot]       = useState(false);
  const [forgotEmail,      setForgotEmail]      = useState('');
  const [forgotEmailErr,   setForgotEmailErr]   = useState('');
  const [forgotLoading,    setForgotLoading]    = useState(false);
  const [forgotSent,       setForgotSent]       = useState(false);

  // Live validation
  const handleEmailChange = (v: string) => {
    setEmail(v);
    if (emailErr) setEmailErr(validateEmail(v));
  };
  const handlePasswordChange = (v: string) => {
    setPassword(v);
    if (passwordErr) setPasswordErr(validatePassword(v));
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailErr(eErr);
    setPasswordErr(pErr);
    if (eErr || pErr) return;

    setError('');
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  const handleWebAuthn = async () => {
    setError('');
    setLoading(true);
    const { error } = await signInWithWebAuthn();
    if (error) { setError(error.message); setLoading(false); }
    else navigate('/dashboard');
  };

  // ── Forgot password ──────────────────────────────────────────────────────
  const handleForgotEmailChange = (v: string) => {
    setForgotEmail(v);
    if (forgotEmailErr) setForgotEmailErr(validateEmail(v));
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(forgotEmail);
    setForgotEmailErr(err);
    if (err) return;

    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);

    if (error) {
      setForgotEmailErr(error.message);
      showNotification('Reset Failed', error.message, 'error');
    } else {
      setForgotSent(true);
      showNotification('Email Sent', `Password reset link sent to ${forgotEmail}`, 'success');
    }
  };

  // ── Forgot-password screen ───────────────────────────────────────────────
  if (showForgot) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 dark:border-gray-700/20">
            <button
              onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); setForgotEmailErr(''); }}
              className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Sign In
            </button>

            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <KeyRound className="w-8 h-8 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">Forgot Password?</h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-8 text-sm">
              Enter your .com email and we'll send a recovery link.
            </p>

            {forgotSent ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <p className="font-semibold text-gray-900 dark:text-white">Check your inbox!</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  A password reset link was sent to <span className="font-medium">{forgotEmail}</span>.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Didn't receive it? Check your spam folder.</p>
                <button
                  onClick={() => { setForgotSent(false); setForgotEmail(''); }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Try a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={forgotEmail}
                      onChange={e => handleForgotEmailChange(e.target.value)}
                      onBlur={() => setForgotEmailErr(validateEmail(forgotEmail))}
                      className={`w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-700 border-2 rounded-2xl focus:outline-none transition-colors text-gray-900 dark:text-white ${
                        forgotEmailErr
                          ? 'border-red-400 dark:border-red-500 focus:border-red-500'
                          : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400'
                      }`}
                      placeholder="you@example.com"
                    />
                  </div>
                  {forgotEmailErr && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{forgotEmailErr}</p>}
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-2xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main login screen ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 dark:border-gray-700/20">
          <div className="flex justify-center mb-8">
            <Logo size={50} showText={true} />
          </div>

          <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">Welcome Back</h1>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-8">Sign in to access your dashboard</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-4 mb-6" noValidate>
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={email}
                  onChange={e => handleEmailChange(e.target.value)}
                  onBlur={() => setEmailErr(validateEmail(email))}
                  className={`w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-700 border-2 rounded-2xl focus:outline-none transition-colors text-gray-900 dark:text-white ${
                    emailErr
                      ? 'border-red-400 dark:border-red-500 focus:border-red-500'
                      : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400'
                  }`}
                  placeholder="you@example.com"
                />
              </div>
              {emailErr && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{emailErr}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => handlePasswordChange(e.target.value)}
                  onBlur={() => setPasswordErr(validatePassword(password))}
                  className={`w-full pl-12 pr-12 py-3 bg-white dark:bg-gray-700 border-2 rounded-2xl focus:outline-none transition-colors text-gray-900 dark:text-white ${
                    passwordErr
                      ? 'border-red-400 dark:border-red-500 focus:border-red-500'
                      : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400'
                  }`}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordErr && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{passwordErr}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white/70 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={handleWebAuthn} disabled={loading}
              className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50">
              <Fingerprint className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Fingerprint</span>
            </button>
            <button onClick={() => setShowVoice(true)} disabled={loading}
              className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl hover:border-pink-500 dark:hover:border-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors disabled:opacity-50">
              <Mic className="w-5 h-5 text-pink-600 dark:text-pink-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Voice Lock</span>
            </button>
          </div>

          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold">Sign up</Link>
          </p>
        </div>
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-8">Protected by enterprise-grade security</p>
      </div>

      {showVoice && (
        <VoiceLock mode="verify" onSuccess={() => { setShowVoice(false); navigate('/dashboard'); }} onCancel={() => setShowVoice(false)} />
      )}
    </div>
  );
}