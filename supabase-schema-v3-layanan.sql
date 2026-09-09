-- Ulas AI v3 - lokasi layanan per RS dan observabilitas AI
-- Idempotent: aman dijalankan lebih dari sekali di Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS lokasi_layanan_rs (
  id SERIAL PRIMARY KEY,
  rumah_sakit_id INTEGER NOT NULL REFERENCES rumah_sakit(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('poli', 'ruangan', 'unit', 'fasilitas')),
  kata_kunci TEXT[] NOT NULL DEFAULT '{}',
  aktif BOOLEAN NOT NULL DEFAULT true,
  urutan INTEGER NOT NULL DEFAULT 0,
  dibuat_pada TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  diperbarui_pada TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (rumah_sakit_id, nama)
);

CREATE INDEX IF NOT EXISTS lokasi_layanan_rs_rs_idx
  ON lokasi_layanan_rs(rumah_sakit_id, aktif, urutan);

CREATE TABLE IF NOT EXISTS hasil_lokasi_ulasans (
  id SERIAL PRIMARY KEY,
  ulasan_id INTEGER NOT NULL REFERENCES ulasan(id) ON DELETE CASCADE,
  lokasi_layanan_id INTEGER NOT NULL REFERENCES lokasi_layanan_rs(id) ON DELETE CASCADE,
  metode TEXT NOT NULL DEFAULT 'keyword' CHECK (metode IN ('keyword', 'ai')),
  kutipan TEXT,
  dibuat_pada TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (ulasan_id, lokasi_layanan_id)
);

CREATE INDEX IF NOT EXISTS hasil_lokasi_ulasan_idx ON hasil_lokasi_ulasans(ulasan_id);
CREATE INDEX IF NOT EXISTS hasil_lokasi_layanan_idx ON hasil_lokasi_ulasans(lokasi_layanan_id);

ALTER TABLE ulasan
  ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT 'menunggu',
  ADD COLUMN IF NOT EXISTS ai_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_error_code TEXT,
  ADD COLUMN IF NOT EXISTS ai_error_message TEXT,
  ADD COLUMN IF NOT EXISTS ai_diproses_pada TIMESTAMP WITH TIME ZONE;

UPDATE ulasan
SET ai_status = CASE
  WHEN sumber_label = 'ai' THEN 'selesai'
  WHEN sumber_label = 'rating' THEN 'retry'
  ELSE 'menunggu'
END
WHERE ai_status IS NULL OR ai_status = 'menunggu';

INSERT INTO aspek (nama_aspek) VALUES
  ('Waktu Tunggu & Kecepatan'),
  ('Sikap & Keramahan Petugas'),
  ('Komunikasi & Kejelasan Informasi'),
  ('Kompetensi & Keamanan Medis'),
  ('Kebersihan & Higiene'),
  ('Fasilitas & Kenyamanan'),
  ('Administrasi, BPJS & Biaya'),
  ('Obat & Pelayanan Farmasi'),
  ('Akses, Keamanan & Parkir'),
  ('Lainnya')
ON CONFLICT (nama_aspek) DO NOTHING;

INSERT INTO lokasi_layanan_rs (rumah_sakit_id, nama, jenis, kata_kunci, urutan)
SELECT rs.id, seed.nama, seed.jenis, seed.kata_kunci, seed.urutan
FROM rumah_sakit rs
CROSS JOIN (VALUES
  ('IGD', 'unit', ARRAY['igd','ugd','gawat darurat','emergency']::TEXT[], 1),
  ('Pendaftaran', 'unit', ARRAY['pendaftaran','loket pendaftaran','registrasi']::TEXT[], 2),
  ('Kasir/BPJS', 'unit', ARRAY['kasir','bpjs','asuransi','klaim']::TEXT[], 3),
  ('Farmasi', 'unit', ARRAY['farmasi','apotek','pengambilan obat','antrean obat']::TEXT[], 4),
  ('Laboratorium', 'unit', ARRAY['laboratorium','lab','cek darah']::TEXT[], 5),
  ('Radiologi', 'unit', ARRAY['radiologi','rontgen','x-ray','ct scan','mri']::TEXT[], 6),
  ('Rawat Inap', 'unit', ARRAY['rawat inap','bangsal','kamar pasien']::TEXT[], 7),
  ('Ruang Bedah/OK', 'ruangan', ARRAY['ruang bedah','ruang operasi','kamar operasi']::TEXT[], 8),
  ('ICU/HCU', 'ruangan', ARRAY['icu','hcu','intensive care']::TEXT[], 9),
  ('NICU/PICU', 'ruangan', ARRAY['nicu','picu']::TEXT[], 10),
  ('Ruang Bersalin/VK', 'ruangan', ARRAY['ruang bersalin','kamar bersalin','ruang vk']::TEXT[], 11),
  ('Poli Anak', 'poli', ARRAY['poli anak','poliklinik anak','dokter anak']::TEXT[], 12),
  ('Poli Kandungan', 'poli', ARRAY['poli kandungan','poli obgyn','dokter kandungan']::TEXT[], 13),
  ('Poli Penyakit Dalam', 'poli', ARRAY['poli penyakit dalam','dokter penyakit dalam']::TEXT[], 14),
  ('Poli Bedah', 'poli', ARRAY['poli bedah','poliklinik bedah']::TEXT[], 15),
  ('Fasilitas Umum/Parkir', 'fasilitas', ARRAY['parkir','toilet','mushola','kantin','lift']::TEXT[], 16)
) AS seed(nama, jenis, kata_kunci, urutan)
ON CONFLICT (rumah_sakit_id, nama) DO NOTHING;

NOTIFY pgrst, 'reload schema';
