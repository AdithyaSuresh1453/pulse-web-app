import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { showNotification } from '../components/NotificationSystem';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  registerWebAuthn: () => Promise<{ error: Error | null }>;
  signInWithWebAuthn: () => Promise<{ error: Error | null }>;
  registerVoicePassphrase: (passphrase: string) => Promise<{ error: Error | null }>;
  verifyVoicePassphrase: (passphrase: string, transcript: string) => Promise<{ success: boolean }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
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

          const email = session.user.email ?? 'your account';
          showNotification(
            '👋 Welcome back!',
            `Signed in as ${email}`,
            'success'
          );
        }

        if (event === 'SIGNED_OUT') {
          showNotification('Signed out', 'You have been signed out successfully.', 'info');
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (!error) {
      showNotification('Account Created', `Welcome! Your account for ${email} is ready.`, 'success');
    } else {
      showNotification('Sign Up Failed', error.message, 'error');
    }
    return { error: error ? new Error(error.message) : null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showNotification('Sign In Failed', error.message, 'error');
    }
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const registerWebAuthn = async () => {
    try {
      if (!window.PublicKeyCredential) {
        return { error: new Error('WebAuthn not supported') };
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { error: new Error('User not authenticated') };
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'Pulse',
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(user.id),
          name: user.email || 'user',
          displayName: user.email || 'User',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      };

      await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      });

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithWebAuthn = async () => {
    try {
      if (!window.PublicKeyCredential) {
        return { error: new Error('WebAuthn not supported') };
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        timeout: 60000,
        userVerification: 'required',
      };

      const credential = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      });

      if (credential) {
        return { error: null };
      }

      return { error: new Error('Authentication failed') };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const registerVoicePassphrase = async (passphrase: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { error: new Error('User not authenticated') };
      }

      await supabase
        .from('voice_passphrases')
        .update({ is_active: false })
        .eq('user_id', user.id);

      const { error } = await supabase
        .from('voice_passphrases')
        .insert({
          user_id: user.id,
          passphrase: passphrase.toLowerCase().trim(),
          voice_samples: [],
          is_active: true,
        });

      return { error: error ? new Error(error.message) : null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const verifyVoicePassphrase = async (passphrase: string, transcript: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false };
      }

      const { data } = await supabase
        .from('voice_passphrases')
        .select('passphrase')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!data) {
        return { success: false };
      }

      const normalizedPassphrase = passphrase.toLowerCase().trim();
      const normalizedTranscript = transcript.toLowerCase().trim();

      const match = normalizedTranscript.includes(normalizedPassphrase) ||
                    normalizedPassphrase.includes(normalizedTranscript);

      if (match) {
        await supabase
          .from('voice_passphrases')
          .update({ last_used_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('is_active', true);
      }

      return { success: match };
    } catch (error) {
      return { success: false };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signOut,
        registerWebAuthn,
        signInWithWebAuthn,
        registerVoicePassphrase,
        verifyVoicePassphrase,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}