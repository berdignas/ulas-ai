# Ulas AI — Analisis Sentimen Ulasan

Aplikasi web untuk mengubah ulasan Google Maps menjadi insight terstruktur: proporsi sentimen
(positif/netral/negatif), aspek layanan yang perlu diperbaiki dan dipertahankan, serta tren antar periode.

## Fitur

- **Unggah Data** — impor file CSV atau Excel berisi ulasan Google Maps; kolom (nama, rating, teks,
  tanggal) dikenali otomatis, termasuk header berbahasa Indonesia dan format Google Takeout.
- **Dashboard Sentimen** — rekap jumlah, grafik proporsi sentimen, dan kalimat kondisi umum layanan.
- **Daftar Ulasan** — telusuri, saring berdasarkan sentimen, dan cari berdasarkan kata kunci.
- **Analisis Aspek** — aspek yang paling banyak dikeluhkan (perlu diperbaiki) dan dipuji (dipertahankan).
- **Pemantauan Tren** — riwayat analisis, perbandingan dua periode, dan grafik tren sentimen.

## Teknologi

Next.js (App Router), React, Tailwind CSS, shadcn/ui, Drizzle ORM + SQLite (better-sqlite3),
papaparse + xlsx untuk parsing berkas, recharts untuk grafik, dan OpenRouter sebagai AI Gateway.

## Menjalankan

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

Database SQLite dibuat otomatis di folder `data/` saat pertama kali dijalankan.

## Konfigurasi AI

Salin `.env.example` menjadi `.env` lalu isi kunci API OpenCode Zen (gratis):

```bash
OPENCODE_ZEN_API_KEY=...
OPENCODE_ZEN_MODEL=big-pickle   # opsional, model gratis
```

Dapatkan kunci di https://opencode.ai/auth — model gratis tersedia di Zen
(big-pickle, mimo-v2.5-free, ling-3.0-flash-fin-free, nemotron-3-ultra-free).

- **Dengan kunci AI**: setiap ulasan dianalisis oleh AI untuk menentukan sentimen sekaligus
  mengenali aspek layanan (pelayanan, kebersihan, harga, dll).
- **Tanpa kunci AI**: aplikasi tetap berjalan; sentimen ditentukan dari rating bintang sebagai
  fallback (4-5 positif, 1-2 negatif, 3 netral), dan analisis aspek tidak tersedia.

## Struktur Utama

| Path                    | Isi                                            |
| ----------------------- | ---------------------------------------------- |
| `app/`                  | Halaman (dashboard, unggah, ulasan, aspek, tren) |
| `app/api/`              | Route handler (upload, proses, status, data)   |
| `lib/db/`               | Skema dan koneksi Drizzle + SQLite             |
| `lib/parser.ts`         | Parsing CSV/Excel + deteksi kolom otomatis     |
| `lib/ai.ts`             | Pemanggilan OpenRouter + retry + fallback      |
| `lib/analyzer.ts`       | Pipeline analisis sentimen & aspek             |
| `components/`           | Komponen UI (shadcn/ui + kustom)               |
