-- ============================================================================
-- Ulas AI v3 - Migration Schema v2
-- Jalankan file ini di Supabase SQL Editor
-- ============================================================================

-- 1. Penambahan Kolom Konfigurasi AI pada Tabel rumah_sakit
-- Menyimpan nama model AI dan API key per rumah sakit di database
ALTER TABLE rumah_sakit
  ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'NVIDIA Nemotron',
  ADD COLUMN IF NOT EXISTS ai_api_key TEXT;

-- 2. Tabel Admin untuk Login Sederhana (Username & Password)
CREATE TABLE IF NOT EXISTS admin (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  terakhir_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS admin_username_idx ON admin(username);

-- 3. Tabel Sesi Admin (admin_session) untuk Validasi Cookie Sesi
CREATE TABLE IF NOT EXISTS admin_session (
  id TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
  dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  kedaluwarsa_pada TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_session_admin_idx ON admin_session(admin_id);
CREATE INDEX IF NOT EXISTS admin_session_kedaluwarsa_idx ON admin_session(kedaluwarsa_pada);

-- 4. Seed Data Akun Admin Default
-- Username : admin
-- Password : admin
-- Hash SHA-256 dari 'admin' = 8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918
INSERT INTO admin (username, password_hash)
VALUES ('admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918')
ON CONFLICT (username) DO UPDATE
SET password_hash = EXCLUDED.password_hash;
