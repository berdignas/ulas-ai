# Ulas AI — Analisis Sentimen Ulasan

Aplikasi web untuk mengubah ulasan Google Maps menjadi insight terstruktur: proporsi sentimen,
aspek layanan yang perlu diperbaiki dan dipertahankan, serta tren antar periode.

## Fitur

- **Unggah Data** — impor CSV atau Excel berisi ulasan Google Maps.
- **Dashboard Sentimen** — rekap jumlah, grafik proporsi sentimen, dan kondisi umum layanan.
- **Daftar Ulasan** — telusuri, saring, dan cari ulasan.
- **Analisis Aspek** — temukan aspek yang paling sering dikeluhkan dan dipuji.
- **Pemantauan Tren** — bandingkan periode dan pantau tren sentimen.

## Teknologi

Next.js App Router, React, Tailwind CSS, shadcn/ui, Supabase, papaparse + xlsx, recharts,
dan Google Gemini sebagai penyedia AI utama.

## Menjalankan di localhost

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

Untuk instalasi yang sudah memakai schema lama, jalankan
`supabase-schema-v3-layanan.sql` sekali melalui Supabase SQL Editor. Migrasi ini menambahkan
pengaturan Poli/Ruangan, relasi lokasi review, dan status retry AI tanpa menghapus data lama.

## Konfigurasi AI

Tambahkan konfigurasi Supabase dan kunci Gemini yang aktif ke `.env`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash-lite
```

Model dapat diganti dari halaman Pengaturan. Gunakan `gemini-3.5-flash-lite` untuk throughput
tertinggi atau `gemini-3.5-flash` untuk analisis yang lebih teliti. Restart `npm run dev` setiap
kali isi `.env` berubah.

Pengaturan performa opsional:

```bash
ANALYSIS_BATCH_SIZE=8
ANALYSIS_BATCH_MAX_CHARS=12000
GEMINI_REQUEST_GAP_MS=500
```

Jangan commit `.env`. Jika Gemini mengembalikan `API_KEY_INVALID`, buat atau ganti kunci melalui
Google AI Studio lalu restart server lokal.

- **Dengan kunci AI**: AI menentukan sentimen, unit layanan, kategori masalah, urgensi, dan aspek.
- **Tanpa kunci AI valid**: aplikasi memakai rating bintang sebagai fallback dan aspek tidak tersedia.

## Struktur Utama

| Path | Isi |
| --- | --- |
| `app/` | Halaman dashboard, unggah, ulasan, aspek, dan tren |
| `app/api/` | Route handler untuk upload, proses, status, dan data |
| `lib/db/` | Skema dan koneksi Supabase |
| `lib/parser.ts` | Parsing CSV/Excel dan deteksi kolom otomatis |
| `lib/ai.ts` | Pemanggilan Gemini, schema, retry, dan fallback |
| `lib/analyzer.ts` | Pipeline analisis sentimen dan aspek |
| `components/` | Komponen UI |
