import { useState } from 'react';
import { Lock, Fingerprint, ShieldCheck, ShieldX, Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Step = 'idle' | 'password' | 'registering' | 'registered' | 'verifying' | 'verified' | 'failed';

export function BiometricSetup() {
  const { registerWebAuthn, signInWithWebAuthn, hasBiometric } = useAuth();

  const [step,        setStep]        = useState<Step>('idle');
  const [message,     setMessage]     = useState('');
  const [password,    setPassword]    = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [pwErr,       setPwErr]       = useState('');

  // ── Register ────────────────────────────────────────────────────────────

  const handleRegisterClick = () => {
    // First ask for password
    setStep('password');
    setMessage('');
    setPassword('');
    setPwErr('');
  };

  const handlePasswordSubmit = async () => {
    if (!password || password.length < 6) {
      setPwErr('Enter your current password (min 6 characters)');
      return;
    }
    setPwErr('');
    setStep('registering');

    const { error } = await registerWebAuthn(password);

    if (error) {
      setStep('failed');
      setMessage(error.message);
    } else {
      setStep('registered');
      setMessage('Biometric registered! You can now sign in with your fingerprint.');
    }
  };

  // ── Verify ──────────────────────────────────────────────────────────────

  const handleVerify = async () => {
    setStep('verifying');
    setMessage('');

    const { error } = await signInWithWebAuthn();

    if (error) {
      setStep('failed');
      setMessage(error.message);
    } else {
      setStep('verified');
      setMessage('Biometric verified successfully!');
    }
  };

  const reset = () => {
    setStep('idle');
    setMessage('');
    setPassword('');
    setPwErr('');
  };

  const isBusy = step === 'registering' || step === 'verifying';

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Fingerprint className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Biometric Authentication
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Fingerprint · Windows Hello · Face ID
          </p>
        </div>
        {hasBiometric && (
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            Active
          </span>
        )}
      </div>

      {/* Status card */}
      <div className={`rounded-2xl p-4 flex items-center gap-4 transition-all duration-300 ${
        step === 'verified' || step === 'registered'
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          : step === 'failed'
          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          : step === 'password'
          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
          : 'bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600'
      }`}>
        <div className="flex-shrink-0">
          {isBusy && <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />}
          {(step === 'verified' || step === 'registered') && <CheckCircle2 className="w-8 h-8 text-green-500" />}
          {step === 'failed'   && <XCircle    className="w-8 h-8 text-red-500" />}
          {step === 'password' && <Lock       className="w-8 h-8 text-blue-500" />}
          {step === 'idle'     && (hasBiometric
            ? <ShieldCheck className="w-8 h-8 text-green-500" />
            : <ShieldX     className="w-8 h-8 text-gray-400" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {step === 'idle'        && (hasBiometric ? 'Biometric is active' : 'No biometric registered')}
            {step === 'password'    && 'Enter your password to continue'}
            {step === 'registering' && 'Waiting for biometric prompt…'}
            {step === 'registered'  && 'Biometric registered!'}
            {step === 'verifying'   && 'Verifying biometric…'}
            {step === 'verified'    && 'Biometric verified!'}
            {step === 'failed'      && 'Something went wrong'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {step === 'idle'        && (hasBiometric ? 'You can sign in with fingerprint on the login screen.' : 'Tap Register to set up fingerprint login.')}
            {step === 'password'    && 'Your password is needed once to activate biometric.'}
            {step === 'registering' && 'Follow the browser prompt to scan your fingerprint.'}
            {step === 'registered'  && 'Tap Verify to test it, or go to login and use Fingerprint.'}
            {step === 'verifying'   && 'Follow the browser prompt to verify your identity.'}
            {step === 'verified'    && 'Everything is working. Use Fingerprint on the login screen.'}
            {step === 'failed'      && message}
          </p>
        </div>
      </div>

      {/* Password input — shown only when step === 'password' */}
      {step === 'password' && (
        <div className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setPwErr(''); }}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Your current password"
              className={`w-full pl-12 pr-12 py-3 bg-white dark:bg-gray-700 border-2 rounded-2xl focus:outline-none transition-colors text-gray-900 dark:text-white ${
                pwErr
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-200 dark:border-gray-600 focus:border-green-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {pwErr && <p className="text-xs text-red-600 dark:text-red-400">{pwErr}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={reset}
              className="py-3 rounded-2xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handlePasswordSubmit}
              className="py-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium text-sm hover:from-green-600 hover:to-emerald-700 transition-all"
            >
              Activate Biometric
            </button>
          </div>
        </div>
      )}

      {/* Action buttons — shown when not in password entry mode */}
      {step !== 'password' && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleRegisterClick}
            disabled={isBusy}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium text-sm transition-all shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 'registering'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Fingerprint className="w-4 h-4" />}
            {hasBiometric ? 'Re-Register' : 'Register'}
          </button>

          <button
            onClick={handleVerify}
            disabled={isBusy || (!hasBiometric && step === 'idle')}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 'verifying'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ShieldCheck className="w-4 h-4" />}
            Verify
          </button>
        </div>
      )}

      {/* Reset after failed/verified */}
      {(step === 'failed' || step === 'verified') && (
        <button
          onClick={reset}
          className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors text-center"
        >
          Reset
        </button>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center leading-relaxed">
        Your biometric data never leaves your device. Only a secure credential is stored locally.
      </p>
    </div>
  );
}