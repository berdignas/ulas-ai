# Data uji unggah manual

Semua nama dan pengalaman dalam `ulasan-testing-15.csv` adalah fiktif untuk pengujian, bukan kesaksian pasien nyata.

Unggah file melalui halaman **Unggah**, lalu jalankan analisis. Header `nama,rating,ulasan,tanggal` sesuai dengan parser aplikasi. Kolom label sengaja tidak dimasukkan agar klasifikasi tetap dilakukan oleh aplikasi.

Label yang diharapkan:

| Pengulas | Sentimen | Jumlah |
| --- | --- | --- |
| Pengulas Uji 01–05 | Positif | 5 |
| Pengulas Uji 06–10 | Netral | 5 |
| Pengulas Uji 11–15 | Negatif | 5 |

Hasil model dapat berbeda dari label yang diharapkan. Ulasan netral ditulis sebagai deskripsi faktual tanpa pujian atau keluhan.

Untuk menguji hapus: masuk sebagai admin, buka **Daftar Ulasan**, klik **Hapus** pada salah satu baris, lalu konfirmasi. Batal harus mempertahankan data. Penghapusan berhasil harus mengurangi total dan jumlah sentimen yang bersangkutan, termasuk setelah halaman dimuat ulang. Analisis yang masih menunggu atau berjalan tidak dapat dihapus per ulasan.

Penghapusan memakai `DATABASE_URL` dan transaksi PostgreSQL agar data ulasan, relasi aspek/lokasi, serta jumlah sentimen berubah bersama. Ringkasan naratif lama dikosongkan agar tidak menampilkan kesimpulan berdasarkan data yang sudah dihapus.
