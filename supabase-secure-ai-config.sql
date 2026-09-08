-- Jalankan sekali di Supabase SQL Editor setelah konfigurasi key dipindah ke Vercel.
-- Model tetap disimpan per rumah sakit; API key lama dihapus dari database.

UPDATE rumah_sakit
SET ai_api_key = NULL
WHERE ai_api_key IS NOT NULL;

ALTER TABLE rumah_sakit
  ALTER COLUMN ai_model SET DEFAULT 'gemini-3.5-flash-lite';

COMMENT ON COLUMN rumah_sakit.ai_api_key IS
  'Deprecated. API key AI disimpan hanya sebagai environment variable server.';
