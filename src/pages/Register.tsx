import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Fingerprint, Mic, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import  Logo  from '../components/Logo';
import { VoiceLock } from '../components/VoiceLock';

// ── Validation helpers ────────────────────────────────────────────────────────
function validateEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required.';
  const localPart = trimmed.split('@')[0];
  if (!localPart) return 'Enter a valid email address.';
  if (/^\d+$/.test(localPart)) return 'Email cannot be only numbers before @.';
  if (!trimmed.toLowerCase().endsWith('.com')) return 'Only .com email addresses are allowed.';
  const emailRegex = /^[a-zA-Z][a-zA-Z0-9._%+\-]*@[a-zA-Z0-9.\-]+\.com$/;
  if (!emailRegex.test(trimmed)) return 'Enter a valid email address (e.g. you@example.com).';
  return '';
}

interface PwStrength {
  score: number; // 0-4
  label: string;
  color: string;
  checks: { label: string; pass: boolean }[];
}

function checkPassword(pw: string): PwStrength {
  const checks = [
    { label: 'At least 6 characters',         pass: pw.length >= 6 },
    { label: 'Contains a letter',              pass: /[a-zA-Z]/.test(pw) },
    { label: 'Contains a number',              pass: /\d/.test(pw) },
    { label: 'Contains special character',     pass: /[^a-zA-Z0-9]/.test(pw) },
  ];
  const score = checks.filter(c => c.pass).length;
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['bg-red-500', 'bg-red-400', 'bg-yellow-400', 'bg-blue-500', 'bg-green-500'];
  return { score, label: labels[score], color: colors[score], checks };
}

export function Register() {
  const navigate = useNavigate();
  const { signUp, registerWebAuthn } = useAuth();

  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw,          setShowPw]          = useState(false);
  const [emailErr,        setEmailErr]        = useState('');
  const [passwordErr,     setPasswordErr]     = useState('');
  const [confirmErr,      setConfirmErr]      = useState('');
  const [error,           setError]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [step,            setStep]            = useState<'credentials' | 'mfa'>('credentials');
  const [showVoice,       setShowVoice]       = useState(false);
  const [showStrength,    setShowStrength]    = useState(false);

  const pwStrength = checkPassword(password);

  const handleEmailChange = (v: string) => {
    setEmail(v);
    if (emailErr) setEmailErr(validateEmail(v));
  };
  const handlePasswordChange = (v: string) => {
    setPassword(v);
    if (passwordErr && v.length < 6) setPasswordErr('Password must be at least 6 characters.');
    else if (passwordErr) setPasswordErr('');
    if (confirmErr && confirmPassword) setConfirmErr(v !== confirmPassword ? 'Passwords do not match.' : '');
  };
  const handleConfirmChange = (v: string) => {
    setConfirmPassword(v);
    if (confirmErr) setConfirmErr(v !== password ? 'Passwords do not match.' : '');
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const eErr = validateEmail(email);
    const pErr = password.length < 6 ? 'Password must be at least 6 characters.' : '';
    const cErr = password !== confirmPassword ? 'Passwords do not match.' : '';
    setEmailErr(eErr);
    setPasswordErr(pErr);
    setConfirmErr(cErr);
    if (eErr || pErr || cErr) return;

    setError('');
    setLoading(true);
    const { error } = await signUp(email.trim(), password);
    if (error) { setError(error.message); setLoading(false); }
    else { setStep('mfa'); setLoading(false); }
  };

  const handleWebAuthnSetup = async () => {
    setError('');
    const { error } = await registerWebAuthn();
    if (error) setError(error.message);
    else navigate('/dashboard');
  };

  // ── MFA step ─────────────────────────────────────────────────────────────
  if (step === 'mfa') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 dark:border-gray-700/20">
            <div className="flex justify-center mb-8"><Logo size={50} showText={true} /></div>
            <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">Secure Your Account</h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-8">Add an extra layer of security</p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-3 mb-6">
              <button onClick={handleWebAuthnSetup}
                className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-2xl shadow-lg shadow-green-500/30 transition-all">
                <Fingerprint className="w-6 h-6" />
                Set Up Fingerprint / Windows Hello
              </button>
              <button onClick={() => setShowVoice(true)}
                className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-semibold rounded-2xl shadow-lg shadow-pink-500/30 transition-all">
                <Mic className="w-6 h-6" />
                Set Up Voice Lock
              </button>
              <button onClick={() => navigate('/dashboard')}
                className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                Skip for Now
              </button>
            </div>
          </div>
        </div>
        {showVoice && (
          <VoiceLock mode="register"
            onSuccess={() => { setShowVoice(false); navigate('/dashboard'); }}
            onCancel={() => setShowVoice(false)} />
        )}
      </div>
    );
  }

  // ── Credentials step ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 dark:border-gray-700/20">
          <div className="flex justify-center mb-8"><Logo size={50} showText={true} /></div>
          <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">Create Account</h1>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-8">Start tracking your belongings today</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleEmailSignup} className="space-y-4 mb-6" noValidate>
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
                    emailErr ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400'
                  }`}
                  placeholder="you@example.com"
                />
              </div>
              {emailErr && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{emailErr}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => handlePasswordChange(e.target.value)}
                  onFocus={() => setShowStrength(true)}
                  onBlur={() => { setShowStrength(false); if (!password) setPasswordErr('Password is required.'); else if (password.length < 6) setPasswordErr('Password must be at least 6 characters.'); }}
                  className={`w-full pl-12 pr-12 py-3 bg-white dark:bg-gray-700 border-2 rounded-2xl focus:outline-none transition-colors text-gray-900 dark:text-white ${
                    passwordErr ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400'
                  }`}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordErr && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{passwordErr}</p>}

              {/* Password strength meter */}
              {(showStrength || password.length > 0) && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= pwStrength.score ? pwStrength.color : 'bg-gray-200 dark:bg-gray-600'}`} />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${pwStrength.score <= 1 ? 'text-red-500' : pwStrength.score === 2 ? 'text-yellow-500' : pwStrength.score === 3 ? 'text-blue-500' : 'text-green-500'}`}>
                    {pwStrength.label}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {pwStrength.checks.map(c => (
                      <div key={c.label} className="flex items-center gap-1.5">
                        {c.pass
                          ? <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                          : <XCircle    className="w-3 h-3 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                        }
                        <span className={`text-xs ${c.pass ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => handleConfirmChange(e.target.value)}
                  onBlur={() => setConfirmErr(password !== confirmPassword ? 'Passwords do not match.' : '')}
                  className={`w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-700 border-2 rounded-2xl focus:outline-none transition-colors text-gray-900 dark:text-white ${
                    confirmErr ? 'border-red-400 dark:border-red-500' : confirmPassword && confirmPassword === password ? 'border-green-400 dark:border-green-500' : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400'
                  }`}
                  placeholder="••••••••"
                />
                {confirmPassword && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2">
                    {confirmPassword === password
                      ? <CheckCircle className="w-5 h-5 text-green-500" />
                      : <XCircle    className="w-5 h-5 text-red-400" />
                    }
                  </span>
                )}
              </div>
              {confirmErr && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{confirmErr}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold">Sign in</Link>
          </p>
        </div>
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-8">
          By signing up, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}