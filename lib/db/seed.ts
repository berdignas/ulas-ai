import { supabase, toSnake } from "./index";
import { kategoriMasalah, unitLayanan } from "./schema";

export async function seedDatabase() {
  console.log("Seeding database defaults via Supabase REST API...");

  const defaultKategori = [
    { nama: "Waktu Tunggu", deskripsi: "Antrian lama, lambat, menunggu lama", urutan: 1, aktif: true },
    { nama: "Keramahan Staf", deskripsi: "Tidak ramah, kasar, acuh", urutan: 2, aktif: true },
    { nama: "Kebersihan", deskripsi: "Kotor, bau, tidak bersih", urutan: 3, aktif: true },
    { nama: "Akurasi Administrasi", deskripsi: "Salah tagihan, salah data", urutan: 4, aktif: true },
    { nama: "Kompetensi Medis", deskripsi: "Salah diagnosis, salah obat", urutan: 5, aktif: true },
    { nama: "Lainnya", deskripsi: "Kategori lain", urutan: 99, aktif: true },
  ];

  const defaultUnit = [
    { nama: "IGD", deskripsi: "Gawat darurat, darurat, ambulance", urutan: 1, aktif: true },
    { nama: "Farmasi", deskripsi: "Apotek, obat, resep, racikan", urutan: 2, aktif: true },
    { nama: "Poliklinik/Dokter", deskripsi: "Poli, dokter, spesialis, konsultasi", urutan: 3, aktif: true },
    { nama: "Rawat Inap", deskripsi: "Kamar, rawat inap, perawat, kebersihan kamar", urutan: 4, aktif: true },
    { nama: "Kasir/BPJS", deskripsi: "Pembayaran, BPJS, klaim, administrasi biaya", urutan: 5, aktif: true },
    { nama: "Fasilitas & Parkir", deskripsi: "Parkir, toilet, lift, wifi, makanan kantin", urutan: 6, aktif: true },
    { nama: "Lainnya", deskripsi: "Unit layanan lain", urutan: 99, aktif: true },
  ];

  await supabase.from(kategoriMasalah).upsert(toSnake(defaultKategori), { onConflict: "nama" });
  await supabase.from(unitLayanan).upsert(toSnake(defaultUnit), { onConflict: "nama" });

  console.log("Database seeded successfully via Supabase REST API!");
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
