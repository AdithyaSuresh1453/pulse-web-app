// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';           // adjust if your path differs
import { showNotification } from '../components/NotificationSystem';

// ── Biometric credential storage ──────────────────────────────────────────────

const BIOMETRIC_KEY = 'pulse_biometric_creds';

interface StoredCreds {
  email:    string;
  password: string;
}

function saveCredentials(creds: StoredCreds) {
  try { localStorage.setItem(BIOMETRIC_KEY, JSON.stringify(creds)); } catch {}
}

function loadCredentials(): StoredCreds | null {
  try {
    const raw = localStorage.getItem(BIOMETRIC_KEY);
    return raw ? JSON.parse(raw) as StoredCreds : null;
  } catch { return null; }
}

function clearCredentials() {
  try { localStorage.removeItem(BIOMETRIC_KEY); } catch {}
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user:                    User | null;
  session:                 Session | null;          // ← added
  loading:                 boolean;
  isRecoverySession:       boolean;
  hasBiometric:            boolean;
  signUp:                  (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn:                  (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut:                 () => Promise<void>;
  registerWebAuthn:        (password: string) => Promise<{ error: Error | null }>;
  signInWithWebAuthn:      (email?: string) => Promise<{ error: Error | null }>;
  registerVoicePassphrase: (passphrase: string) => Promise<{ error: Error | null }>;
  verifyVoicePassphrase:   (passphrase: string, transcript: string) => Promise<{ success: boolean }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Helpers ───────────────────────────────────────────────────────────────────

function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

async function isPlatformAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,              setUser]         = useState<User | null>(null);
  const [session,           setSession]      = useState<Session | null>(null); // ← added
  const [loading,           setLoading]      = useState(true);
  const [isRecoverySession, setIsRecovery]   = useState(false);
  const [hasBiometric,      setHasBiometric] = useState<boolean>(() => !!loadCredentials());

  // ── Session listener ─────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        (async () => {
          if (event === 'PASSWORD_RECOVERY') {
            setSession(session);
            setUser(session?.user ?? null);
            setIsRecovery(true);
            setLoading(false);
            return;
          }

          setSession(session);
          setUser(session?.user ?? null);

          if (event === 'SIGNED_IN' && session?.user) {
            const { data: existing } = await supabase
              .from('user_preferences')
              .select('id')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (!existing) {
              await supabase
                .from('user_preferences')
                .insert({ user_id: session.user.id });
            }

            showNotification(
              '👋 Welcome back!',
              `Signed in as ${session.user.email ?? 'your account'}`,
              'success'
            );
          }

          if (event === 'SIGNED_OUT') {
            setIsRecovery(false);
            showNotification('Signed out', 'You have been signed out successfully.', 'info');
          }
        })();
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Sign Up ───────────────────────────────────────────────────────────────

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (!error) {
      showNotification('Account Created', 'Check your email to confirm your account.', 'success');
    } else {
      showNotification('Sign Up Failed', error.message, 'error');
    }
    return { error: error ? new Error(error.message) : null };
  };

  // ── Sign In ───────────────────────────────────────────────────────────────

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) showNotification('Sign In Failed', error.message, 'error');
    return { error: error ? new Error(error.message) : null };
  };

  // ── Sign Out ──────────────────────────────────────────────────────────────

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // ── Register WebAuthn ─────────────────────────────────────────────────────

  const registerWebAuthn = async (password: string) => {
    try {
      if (!isWebAuthnSupported()) {
        return { error: new Error('WebAuthn not supported on this device') };
      }

      const available = await isPlatformAvailable();
      if (!available) {
        return { error: new Error('No biometric authenticator available on this device') };
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user)       return { error: new Error('Please sign in first') };
      if (!user.email) return { error: new Error('No email associated with this account') };

      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email, password,
      });
      if (verifyErr) return { error: new Error('Incorrect password — please try again') };

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Pulse', id: window.location.hostname },
          user: {
            id:          new TextEncoder().encode(user.id),
            name:        user.email,
            displayName: user.email,
          },
          pubKeyCredParams: [
            { alg: -7,   type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification:        'required',
            residentKey:             'preferred',
          },
          timeout:     60000,
          attestation: 'none',
        },
      });

      saveCredentials({ email: user.email, password });
      setHasBiometric(true);
      return { error: null };

    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('cancel') || msg.includes('abort')) {
        return { error: new Error('Biometric prompt was cancelled') };
      }
      return { error: error as Error };
    }
  };

  // ── Sign In with WebAuthn ─────────────────────────────────────────────────

  const signInWithWebAuthn = async (_email?: string) => {
    try {
      if (!isWebAuthnSupported()) {
        return { error: new Error('WebAuthn not supported on this device') };
      }

      const available = await isPlatformAvailable();
      if (!available) {
        return { error: new Error('No biometric authenticator available') };
      }

      const creds = loadCredentials();
      if (!creds) {
        return { error: new Error('No biometric registered. Please set up biometric in Settings first.') };
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout:          60000,
          userVerification: 'required',
        },
      });

      if (!credential) {
        return { error: new Error('Biometric verification failed') };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email:    creds.email,
        password: creds.password,
      });

      if (error) {
        clearCredentials();
        setHasBiometric(false);
        return { error: new Error('Biometric credentials expired. Please sign in with password and re-register biometric in Settings.') };
      }

      return { error: null };

    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('cancel') || msg.includes('abort')) {
        return { error: new Error('cancelled') };
      }
      if (msg.includes('not allowed') || msg.includes('No credentials')) {
        return { error: new Error('No biometric registered') };
      }
      return { error: error as Error };
    }
  };

  // ── Voice Passphrase ──────────────────────────────────────────────────────

  const registerVoicePassphrase = async (passphrase: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: new Error('User not authenticated') };

      await supabase
        .from('voice_passphrases')
        .update({ is_active: false })
        .eq('user_id', user.id);

      const { error } = await supabase
        .from('voice_passphrases')
        .insert({
          user_id:       user.id,
          passphrase:    passphrase.toLowerCase().trim(),
          voice_samples: [],
          is_active:     true,
        });

      return { error: error ? new Error(error.message) : null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const verifyVoicePassphrase = async (passphrase: string, transcript: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false };

      const { data } = await supabase
        .from('voice_passphrases')
        .select('passphrase')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!data) return { success: false };

      const np    = passphrase.toLowerCase().trim();
      const nt    = transcript.toLowerCase().trim();
      const match = nt.includes(np) || np.includes(nt);

      if (match) {
        await supabase
          .from('voice_passphrases')
          .update({ last_used_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('is_active', true);
      }

      return { success: match };
    } catch {
      return { success: false };
    }
  };

  // ── Return ────────────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isRecoverySession,
      hasBiometric,
      signUp,
      signIn,
      signOut,
      registerWebAuthn,
      signInWithWebAuthn,
      registerVoicePassphrase,
      verifyVoicePassphrase,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── useAuth hook ──────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

// ── useIsAdmin hook (from second project) ────────────────────────────────────

export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const checkAdmin = async () => {
      const { data, error } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' });
      setIsAdmin(!!data && !error);
      setLoading(false);
    };

    checkAdmin();
  }, [user]);

  return { isAdmin, loading };
}