import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

export function AuthConfirm() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const [status,  setStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [errMsg,  setErrMsg] = useState('');

  useEffect(() => {
    const token_hash = params.get('token_hash');
    const type       = params.get('type') as 'signup' | 'email' | 'recovery' | null;

    if (!token_hash || !type) {
      setErrMsg('Invalid confirmation link.');
      setStatus('error');
      return;
    }

    const verify = async () => {
      // Step 1 — try verifyOtp directly
      const { error } = await supabase.auth.verifyOtp({ token_hash, type });

      if (!error) {
        setStatus('success');
        setTimeout(() => navigate('/dashboard'), 2500);
        return;
      }

      // Step 2 — if verifyOtp failed, check if session already exists
      // This happens when PKCE already consumed the token on redirect
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setStatus('success');
        setTimeout(() => navigate('/dashboard'), 2500);
        return;
      }

      // Step 3 — truly expired or invalid
      setErrMsg('This confirmation link has expired or already been used. Please sign up again.');
      setStatus('error');
    };

    verify();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 dark:border-gray-700/20">

          <div className="flex justify-center mb-8">
            <Logo size={50} showText={true} />
          </div>

          {/* Checking */}
          {status === 'checking' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-600 dark:text-gray-400">Verifying your email...</p>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Email Verified!</h2>
              <p className="text-gray-600 dark:text-gray-400">Your account is now active.</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting to dashboard...</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Link Expired</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{errMsg}</p>
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/register')}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-2xl hover:from-blue-700 hover:to-blue-800 transition-all"
                >
                  Sign Up Again
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}