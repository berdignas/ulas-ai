-- Jalankan sekali di Supabase SQL Editor untuk mengaktifkan role akun.
ALTER TABLE admin
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_role_check'
  ) THEN
    ALTER TABLE admin ADD CONSTRAINT admin_role_check
      CHECK (role IN ('admin', 'pkrs', 'pengaduan'));
  END IF;
END $$;

-- Password disimpan sebagai SHA-256, bukan plaintext.
INSERT INTO admin (username, password_hash, role)
VALUES
  ('admin', '91ba8114e3f14912d9168e954c6664320087cd159d2f4bb67ba36fef2ec381f7', 'admin'),
  ('pkrs', '06ee3dc95f02f454277fa17874b21d10665a6b8c0075a630e5fa60e25a59a1ec', 'pkrs'),
  ('pengaduan', 'e507c62fa6af4d504b747dbe42521f47b03a3d31f84663a45937fd020ed3dacc', 'pengaduan')
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role;
