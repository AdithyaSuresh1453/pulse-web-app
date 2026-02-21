/*
  # Pulse - Keep a Beat on Your Belongings - Database Schema

  ## Overview
  This migration creates the complete database schema for the Pulse SaaS application,
  including tables for object tracking, activity logs, and voice authentication.

  ## New Tables Created

  ### 1. `objects`
  Stores registered objects that users want to track
  - `id` (uuid, primary key) - Unique object identifier
  - `user_id` (uuid, foreign key) - Links to auth.users
  - `object_id` (text) - Human-readable object ID
  - `object_name` (text) - Name of the object (e.g., "Keys", "Wallet")
  - `usual_location` (text) - Where the object is typically kept
  - `last_known_location` (text) - Most recent detected location
  - `last_detected_time` (timestamptz) - When object was last detected
  - `image_url` (text) - URL to object image in Supabase Storage
  - `created_at` (timestamptz) - When object was registered
  - `updated_at` (timestamptz) - Last modification time

  ### 2. `activity_logs`
  Tracks all object detection and location change events
  - `id` (uuid, primary key) - Unique log entry identifier
  - `user_id` (uuid, foreign key) - Links to auth.users
  - `object_id` (uuid, foreign key) - Links to objects table
  - `activity_type` (text) - Type of activity (detected, moved, missing, etc.)
  - `location` (text) - Location where activity occurred
  - `confidence` (numeric) - Detection confidence score (0-1)
  - `metadata` (jsonb) - Additional data (camera info, detection details)
  - `created_at` (timestamptz) - When activity occurred

  ### 3. `voice_passphrases`
  Stores voice authentication passphrases for users
  - `id` (uuid, primary key) - Unique record identifier
  - `user_id` (uuid, foreign key) - Links to auth.users
  - `passphrase` (text) - The spoken passphrase text
  - `voice_samples` (jsonb) - Array of voice sample metadata
  - `is_active` (boolean) - Whether this passphrase is currently active
  - `created_at` (timestamptz) - When passphrase was registered
  - `last_used_at` (timestamptz) - Last successful voice authentication

  ### 4. `user_preferences`
  Stores user settings and preferences
  - `id` (uuid, primary key) - Unique record identifier
  - `user_id` (uuid, foreign key) - Links to auth.users
  - `theme` (text) - UI theme preference (light/dark)
  - `voice_assistant_enabled` (boolean) - Voice assistant on/off
  - `camera_detection_enabled` (boolean) - Auto camera detection
  - `notification_sound_enabled` (boolean) - Alert sounds on/off
  - `alert_sensitivity` (text) - Alert sensitivity level
  - `created_at` (timestamptz) - When preferences were created
  - `updated_at` (timestamptz) - Last preference update

  ## Security
  - Row Level Security (RLS) is enabled on all tables
  - Users can only access their own data
  - Policies enforce user_id matching auth.uid()
  - Separate policies for SELECT, INSERT, UPDATE, DELETE operations

  ## Important Notes
  - All timestamps use timestamptz for proper timezone handling
  - Foreign keys ensure referential integrity
  - Indexes on user_id and created_at for query performance
  - JSONB used for flexible metadata storage
*/

-- Create objects table
CREATE TABLE IF NOT EXISTS objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  object_id text NOT NULL,
  object_name text NOT NULL,
  usual_location text DEFAULT '',
  last_known_location text DEFAULT '',
  last_detected_time timestamptz,
  image_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  object_id uuid REFERENCES objects(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  location text DEFAULT '',
  confidence numeric DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create voice_passphrases table
CREATE TABLE IF NOT EXISTS voice_passphrases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  passphrase text NOT NULL,
  voice_samples jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  theme text DEFAULT 'light',
  voice_assistant_enabled boolean DEFAULT true,
  camera_detection_enabled boolean DEFAULT false,
  notification_sound_enabled boolean DEFAULT true,
  alert_sensitivity text DEFAULT 'medium',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_objects_user_id ON objects(user_id);
CREATE INDEX IF NOT EXISTS idx_objects_created_at ON objects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_object_id ON activity_logs(object_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_passphrases_user_id ON voice_passphrases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Enable Row Level Security on all tables
ALTER TABLE objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_passphrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for objects table
CREATE POLICY "Users can view own objects"
  ON objects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own objects"
  ON objects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own objects"
  ON objects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own objects"
  ON objects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for activity_logs table
CREATE POLICY "Users can view own activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own activity logs"
  ON activity_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for voice_passphrases table
CREATE POLICY "Users can view own voice passphrases"
  ON voice_passphrases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voice passphrases"
  ON voice_passphrases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own voice passphrases"
  ON voice_passphrases FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own voice passphrases"
  ON voice_passphrases FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for user_preferences table
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON user_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_objects_updated_at
  BEFORE UPDATE ON objects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for object images
INSERT INTO storage.buckets (id, name, public)
VALUES ('object-images', 'object-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for object-images bucket
CREATE POLICY "Users can upload own object images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'object-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own object images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'object-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public can view object images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'object-images');

CREATE POLICY "Users can update own object images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'object-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'object-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own object images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'object-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );