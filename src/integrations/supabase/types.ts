export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      // ── From your lib/supabase.ts ──────────────────────────────────────
      objects: {
        Row: {
          id: string
          user_id: string
          object_id: string
          object_name: string
          usual_location: string
          last_known_location: string
          last_detected_time: string | null
          image_url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          object_id: string
          object_name: string
          usual_location?: string
          last_known_location?: string
          last_detected_time?: string | null
          image_url?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          object_id?: string
          object_name?: string
          usual_location?: string
          last_known_location?: string
          last_detected_time?: string | null
          image_url?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          object_id: string | null
          activity_type: string
          location: string
          confidence: number
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          object_id?: string | null
          activity_type: string
          location?: string
          confidence?: number
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          object_id?: string | null
          activity_type?: string
          location?: string
          confidence?: number
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Relationships: []
      }
      voice_passphrases: {
        Row: {
          id: string
          user_id: string
          passphrase: string
          voice_samples: unknown[]
          is_active: boolean
          created_at: string
          last_used_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          passphrase: string
          voice_samples?: unknown[]
          is_active?: boolean
          created_at?: string
          last_used_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          passphrase?: string
          voice_samples?: unknown[]
          is_active?: boolean
          created_at?: string
          last_used_at?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          theme: string
          voice_assistant_enabled: boolean
          camera_detection_enabled: boolean
          notification_sound_enabled: boolean
          alert_sensitivity: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          theme?: string
          voice_assistant_enabled?: boolean
          camera_detection_enabled?: boolean
          notification_sound_enabled?: boolean
          alert_sensitivity?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          theme?: string
          voice_assistant_enabled?: boolean
          camera_detection_enabled?: boolean
          notification_sound_enabled?: boolean
          alert_sensitivity?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      // ── From other project's types.ts ──────────────────────────────────
      detected_objects: {
        Row: {
          confidence: number
          created_at: string
          id: string
          image_url: string | null
          last_seen_at: string
          location: string
          name: string
          size: string
          status: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          image_url?: string | null
          last_seen_at?: string
          location?: string
          name: string
          size?: string
          status?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          image_url?: string | null
          last_seen_at?: string
          location?: string
          name?: string
          size?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      geofence_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          missing_items: string[]
          user_id: string
          zone_id: string
        }
        Insert: {
          alert_type?: string
          created_at?: string
          id?: string
          missing_items?: string[]
          user_id: string
          zone_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          missing_items?: string[]
          user_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofence_alerts_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "geofence_zones"
            referencedColumns: ["id"]
          }
        ]
      }
      geofence_zones: {
        Row: {
          created_at: string
          essential_items: string[]
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          name: string
          radius_meters: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          essential_items?: string[]
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          name: string
          radius_meters?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          essential_items?: string[]
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
          radius_meters?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      medicine_reminders: {
        Row: {
          alarm_sound: string
          alarm_time: string
          created_at: string
          days_of_week: number[]
          dosage: string | null
          id: string
          is_active: boolean
          medicine_name: string
          notes: string | null
          updated_at: string
          user_id: string
          usual_location: string | null
        }
        Insert: {
          alarm_sound?: string
          alarm_time: string
          created_at?: string
          days_of_week?: number[]
          dosage?: string | null
          id?: string
          is_active?: boolean
          medicine_name: string
          notes?: string | null
          updated_at?: string
          user_id: string
          usual_location?: string | null
        }
        Update: {
          alarm_sound?: string
          alarm_time?: string
          created_at?: string
          days_of_week?: number[]
          dosage?: string | null
          id?: string
          is_active?: boolean
          medicine_name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          usual_location?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends { Row: infer R }
      ? R
      : never
    : never

export type TablesInsert
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never

export type TablesUpdate
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
      ? U
      : never
    : never

export type Enums
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const