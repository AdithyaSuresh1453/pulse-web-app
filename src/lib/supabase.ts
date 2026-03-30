import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',         // ✅ changed from 'implicit'
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type Database = {
  public: {
    Tables: {
      objects: {
        Row: {
          id: string;
          user_id: string;
          object_id: string;
          object_name: string;
          usual_location: string;
          last_known_location: string;
          last_detected_time: string | null;
          image_url: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          object_id: string;
          object_name: string;
          usual_location?: string;
          last_known_location?: string;
          last_detected_time?: string | null;
          image_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          object_id?: string;
          object_name?: string;
          usual_location?: string;
          last_known_location?: string;
          last_detected_time?: string | null;
          image_url?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          object_id: string | null;
          activity_type: string;
          location: string;
          confidence: number;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          object_id?: string | null;
          activity_type: string;
          location?: string;
          confidence?: number;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          object_id?: string | null;
          activity_type?: string;
          location?: string;
          confidence?: number;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
      };
      voice_passphrases: {
        Row: {
          id: string;
          user_id: string;
          passphrase: string;
          voice_samples: unknown[];
          is_active: boolean;
          created_at: string;
          last_used_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          passphrase: string;
          voice_samples?: unknown[];
          is_active?: boolean;
          created_at?: string;
          last_used_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          passphrase?: string;
          voice_samples?: unknown[];
          is_active?: boolean;
          created_at?: string;
          last_used_at?: string | null;
        };
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          theme: string;
          voice_assistant_enabled: boolean;
          camera_detection_enabled: boolean;
          notification_sound_enabled: boolean;
          alert_sensitivity: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          theme?: string;
          voice_assistant_enabled?: boolean;
          camera_detection_enabled?: boolean;
          notification_sound_enabled?: boolean;
          alert_sensitivity?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          theme?: string;
          voice_assistant_enabled?: boolean;
          camera_detection_enabled?: boolean;
          notification_sound_enabled?: boolean;
          alert_sensitivity?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};