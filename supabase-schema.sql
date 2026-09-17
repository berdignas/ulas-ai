-- Ulas AI v3 - Supabase PostgreSQL Schema
-- Jalankan di Supabase SQL Editor

-- Enable UUID extension (optional, we use serial for IDs)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE sentimen_enum AS ENUM ('positif', 'negatif', 'netral');
CREATE TYPE status_analisis_enum AS ENUM ('menunggu', 'berjalan', 'selesai', 'gagal', 'berhenti');
CREATE TYPE status_tindak_lanjut_enum AS ENUM ('baru', 'dalam_koordinasi', 'selesai');

-- ============================================
-- TABLES
-- ============================================

-- rumah_sakit
CREATE TABLE rumah_sakit (
    id SERIAL PRIMARY KEY,
    nama TEXT NOT NULL,
    kode TEXT NOT NULL UNIQUE,
    google_maps_place_id TEXT,
    apify_actor_id TEXT DEFAULT 'compass/google-maps-reviews-scraper',
    apify_token TEXT,
    aktif BOOLEAN DEFAULT true,
    zona_waktu TEXT DEFAULT 'Asia/Jakarta',
    jam_sinkron INTEGER DEFAULT 6,
    ai_model TEXT DEFAULT 'gemini-3.5-flash-lite',
    ai_api_key TEXT, -- deprecated: key AI wajib disimpan di environment server
    dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    diperbarui_pada TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- sinkron_log
CREATE TABLE sinkron_log (
    id SERIAL PRIMARY KEY,
    rumah_sakit_id INTEGER NOT NULL REFERENCES rumah_sakit(id) ON DELETE CASCADE,
    dimulai_pada TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    selesai_pada TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL,
    ulasan_baru INTEGER DEFAULT 0,
    ulasan_diproses INTEGER DEFAULT 0,
    ulasan_krisis INTEGER DEFAULT 0,
    pesan_error TEXT,
    tipe_pemicu TEXT DEFAULT 'otomatis'
);
CREATE INDEX sinkron_log_rs_idx ON sinkron_log(rumah_sakit_id);

-- analisis
CREATE TABLE analisis (
    id SERIAL PRIMARY KEY,
    rumah_sakit_id INTEGER NOT NULL REFERENCES rumah_sakit(id) ON DELETE CASCADE,
    nama_file TEXT NOT NULL,
    tanggal_unggah TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    status status_analisis_enum NOT NULL DEFAULT 'menunggu',
    total_ulasan INTEGER NOT NULL DEFAULT 0,
    ulasan_diproses INTEGER NOT NULL DEFAULT 0,
    total_positif INTEGER NOT NULL DEFAULT 0,
    total_negatif INTEGER NOT NULL DEFAULT 0,
    total_netral INTEGER NOT NULL DEFAULT 0,
    kondisi_umum TEXT,
    catatan TEXT,
    sidik_jari TEXT
);
CREATE INDEX analisis_sidik_jari_idx ON analisis(sidik_jari);
CREATE INDEX analisis_rs_idx ON analisis(rumah_sakit_id);

-- ulasan
CREATE TABLE ulasan (
    id SERIAL PRIMARY KEY,
    analisis_id INTEGER NOT NULL REFERENCES analisis(id) ON DELETE CASCADE,
    rumah_sakit_id INTEGER NOT NULL REFERENCES rumah_sakit(id) ON DELETE CASCADE,
    review_id TEXT NOT NULL UNIQUE,
    nama_pengulas TEXT,
    rating INTEGER,
    teks_ulasan TEXT NOT NULL,
    tanggal_ulasan TEXT,
    bahasa TEXT DEFAULT 'id',
    sentimen sentimen_enum,
    sumber_label TEXT,
    unit_layanan TEXT,
    kategori_masalah TEXT,
    faktor_urgensi_medis BOOLEAN DEFAULT false,
    saran_draf_balasan TEXT,
    status_tindak_lanjut status_tindak_lanjut_enum DEFAULT 'baru',
    ditinjau_pada TIMESTAMP WITH TIME ZONE,
    ditinjau_oleh TEXT,
    catatan_internal TEXT,
    data_mentah TEXT,
    dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    diperbarui_pada TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
CREATE INDEX ulasan_analisis_idx ON ulasan(analisis_id);
CREATE INDEX ulasan_rs_idx ON ulasan(rumah_sakit_id);
CREATE INDEX ulasan_tanggal_idx ON ulasan(tanggal_ulasan);
CREATE INDEX ulasan_status_idx ON ulasan(status_tindak_lanjut);
CREATE INDEX ulasan_urgensi_idx ON ulasan(faktor_urgensi_medis);
CREATE UNIQUE INDEX ulasan_review_id_idx ON ulasan(review_id);

-- aspek
CREATE TABLE aspek (
    id SERIAL PRIMARY KEY,
    nama_aspek TEXT NOT NULL
);
CREATE UNIQUE INDEX aspek_nama_idx ON aspek(nama_aspek);

-- hasil_aspek_ulasans
CREATE TABLE hasil_aspek_ulasans (
    id SERIAL PRIMARY KEY,
    ulasan_id INTEGER NOT NULL REFERENCES ulasan(id) ON DELETE CASCADE,
    aspek_id INTEGER NOT NULL REFERENCES aspek(id) ON DELETE CASCADE,
    sentimen_aspek sentimen_enum NOT NULL,
    kutipan TEXT
);

-- kategori_masalah
CREATE TABLE kategori_masalah (
    id SERIAL PRIMARY KEY,
    nama TEXT NOT NULL UNIQUE,
    deskripsi TEXT,
    urutan INTEGER DEFAULT 0,
    aktif BOOLEAN DEFAULT true
);
CREATE UNIQUE INDEX kategori_masalah_nama_idx ON kategori_masalah(nama);

-- unit_layanan
CREATE TABLE unit_layanan (
    id SERIAL PRIMARY KEY,
    nama TEXT NOT NULL UNIQUE,
    deskripsi TEXT,
    urutan INTEGER DEFAULT 0,
    aktif BOOLEAN DEFAULT true
);
CREATE UNIQUE INDEX unit_layanan_nama_idx ON unit_layanan(nama);

-- admin
CREATE TABLE admin (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'pkrs', 'pengaduan')),
    dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    terakhir_login TIMESTAMP WITH TIME ZONE
);
CREATE INDEX admin_username_idx ON admin(username);

-- admin_session
CREATE TABLE admin_session (
    id TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
    dibuat_pada TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    kedaluwarsa_pada TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX admin_session_admin_idx ON admin_session(admin_id);
CREATE INDEX admin_session_kedaluwarsa_idx ON admin_session(kedaluwarsa_pada);

-- Seed akun bawaan (password disimpan sebagai SHA-256)
INSERT INTO admin (username, password_hash)
VALUES ('admin', '91ba8114e3f14912d9168e954c6664320087cd159d2f4bb67ba36fef2ec381f7')
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin';

INSERT INTO admin (username, password_hash, role)
VALUES
  ('pkrs', '06ee3dc95f02f454277fa17874b21d10665a6b8c0075a630e5fa60e25a59a1ec', 'pkrs'),
  ('pengaduan', 'e507c62fa6af4d504b747dbe42521f47b03a3d31f84663a45937fd020ed3dacc', 'pengaduan')
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY (optional - enable if needed)
-- ============================================
-- ALTER TABLE rumah_sakit ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE analisis ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ulasan ENABLE ROW LEVEL SECURITY;
-- etc.

-- ============================================
-- SEED DATA (optional)
-- ============================================
-- INSERT INTO kategori_masalah (nama, deskripsi, urutan, aktif) VALUES
-- ('Waktu Tunggu', 'Antrian lama, lambat, menunggu lama', 1, true),
-- ('Keramahan Staf', 'Tidak ramah, kasar, acuh', 2, true),
-- ('Kebersihan', 'Kotor, bau, tidak bersih', 3, true),
-- ('Akurasi Administrasi', 'Salah tagihan, salah data', 4, true),
-- ('Kompetensi Medis', 'Salah diagnosis, salah obat', 5, true),
-- ('Lainnya', 'Kategori lain', 99, true);

-- INSERT INTO unit_layanan (nama, deskripsi, urutan, aktif) VALUES
-- ('IGD', 'Gawat darurat, darurat, ambulance', 1, true),
-- ('Farmasi', 'Apotek, obat, resep, racikan', 2, true),
-- ('Poliklinik/Dokter', 'Poli, dokter, spesialis, konsultasi', 3, true),
-- ('Rawat Inap', 'Kamar, rawat inap, perawat, kebersihan kamar', 4, true),
-- ('Kasir/BPJS', 'Pembayaran, BPJS, klaim, administrasi biaya', 5, true),
-- ('Fasilitas & Parkir', 'Parkir, toilet, lift, wifi, makanan kantin', 6, true),
-- ('Lainnya', 'Unit layanan lain', 99, true);
