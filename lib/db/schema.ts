import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

export const sentimenEnum = pgEnum("sentimen", ["positif", "negatif", "netral"]);
export const statusAnalisisEnum = pgEnum("status_analisis", [
  "menunggu",
  "berjalan",
  "selesai",
  "gagal",
  "berhenti",
]);
export const statusTindakLanjutEnum = pgEnum("status_tindak_lanjut", [
  "baru",
  "dalam_koordinasi",
  "selesai",
]);

export const rumahSakit = pgTable("rumah_sakit", {
  id: serial("id").primaryKey(),
  nama: text("nama").notNull(),
  kode: text("kode").notNull().unique(),
  googleMapsPlaceId: text("google_maps_place_id"),
  apifyActorId: text("apify_actor_id").default(
    "compass/google-maps-reviews-scraper",
  ),
  apifyToken: text("apify_token"),
  aktif: boolean("aktif").default(true),
  zonaWaktu: text("zona_waktu").default("Asia/Jakarta"),
  jamSinkron: integer("jam_sinkron").default(6),
  dibuatPada: timestamp("dibuat_pada", { mode: "date" }).defaultNow().notNull(),
  diperbaruiPada: timestamp("diperbarui_pada", { mode: "date" })
    .defaultNow()
    .notNull(),
});

export const sinkronLog = pgTable(
  "sinkron_log",
  {
    id: serial("id").primaryKey(),
    rumahSakitId: integer("rumah_sakit_id")
      .notNull()
      .references(() => rumahSakit.id, { onDelete: "cascade" }),
    dimulaiPada: timestamp("dimulai_pada", { mode: "date" })
      .defaultNow()
      .notNull(),
    selesaiPada: timestamp("selesai_pada", { mode: "date" }),
    status: text("status").notNull(),
    ulasanBaru: integer("ulasan_baru").default(0),
    ulasanDiproses: integer("ulasan_diproses").default(0),
    ulasanKrisis: integer("ulasan_krisis").default(0),
    pesanError: text("pesan_error"),
    tipePemicu: text("tipe_pemicu").default("otomatis"),
  },
  (table) => [index("sinkron_log_rs_idx").on(table.rumahSakitId)],
);

export const analisis = pgTable(
  "analisis",
  {
    id: serial("id").primaryKey(),
    rumahSakitId: integer("rumah_sakit_id")
      .notNull()
      .references(() => rumahSakit.id, { onDelete: "cascade" }),
    namaFile: text("nama_file").notNull(),
    tanggalUnggah: timestamp("tanggal_unggah", { mode: "date" })
      .defaultNow()
      .notNull(),
    status: statusAnalisisEnum("status").notNull().default("menunggu"),
    totalUlasan: integer("total_ulasan").notNull().default(0),
    ulasanDiproses: integer("ulasan_diproses").notNull().default(0),
    totalPositif: integer("total_positif").notNull().default(0),
    totalNegatif: integer("total_negatif").notNull().default(0),
    totalNetral: integer("total_netral").notNull().default(0),
    kondisiUmum: text("kondisi_umum"),
    catatan: text("catatan"),
    sidikJari: text("sidik_jari"),
  },
  (table) => [
    index("analisis_sidik_jari_idx").on(table.sidikJari),
    index("analisis_rs_idx").on(table.rumahSakitId),
  ],
);

export const ulasan = pgTable(
  "ulasan",
  {
    id: serial("id").primaryKey(),
    analisisId: integer("analisis_id")
      .notNull()
      .references(() => analisis.id, { onDelete: "cascade" }),
    rumahSakitId: integer("rumah_sakit_id")
      .notNull()
      .references(() => rumahSakit.id, { onDelete: "cascade" }),
    reviewId: text("review_id").notNull().unique(),
    namaPengulas: text("nama_pengulas"),
    rating: integer("rating"),
    teksUlasan: text("teks_ulasan").notNull(),
    tanggalUlasan: text("tanggal_ulasan"),
    bahasa: text("bahasa").default("id"),
    sentimen: sentimenEnum("sentimen"),
    sumberLabel: text("sumber_label"),
    unitLayanan: text("unit_layanan"),
    kategoriMasalah: text("kategori_masalah"),
    faktorUrgensiMedis: boolean("faktor_urgensi_medis").default(false),
    saranDrafBalasan: text("saran_draf_balasan"),
    statusTindakLanjut: statusTindakLanjutEnum("status_tindak_lanjut").default(
      "baru",
    ),
    ditinjauPada: timestamp("ditinjau_pada", { mode: "date" }),
    ditinjauOleh: text("ditinjau_oleh"),
    catatanInternal: text("catatan_internal"),
    dataMentah: text("data_mentah"),
    dibuatPada: timestamp("dibuat_pada", { mode: "date" })
      .defaultNow()
      .notNull(),
    diperbaruiPada: timestamp("diperbarui_pada", { mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ulasan_analisis_idx").on(table.analisisId),
    index("ulasan_rs_idx").on(table.rumahSakitId),
    index("ulasan_tanggal_idx").on(table.tanggalUlasan),
    index("ulasan_status_idx").on(table.statusTindakLanjut),
    index("ulasan_urgensi_idx").on(table.faktorUrgensiMedis),
    uniqueIndex("ulasan_review_id_idx").on(table.reviewId),
  ],
);

export const aspek = pgTable(
  "aspek",
  {
    id: serial("id").primaryKey(),
    namaAspek: text("nama_aspek").notNull(),
  },
  (table) => [uniqueIndex("aspek_nama_idx").on(table.namaAspek)],
);

export const hasilAspekUlasan = pgTable("hasil_aspek_ulasans", {
  id: serial("id").primaryKey(),
  ulasanId: integer("ulasan_id")
    .notNull()
    .references(() => ulasan.id, { onDelete: "cascade" }),
  aspekId: integer("aspek_id")
    .notNull()
    .references(() => aspek.id, { onDelete: "cascade" }),
  sentimenAspek: sentimenEnum("sentimen_aspek").notNull(),
  kutipan: text("kutipan"),
});

export const kategoriMasalah = pgTable(
  "kategori_masalah",
  {
    id: serial("id").primaryKey(),
    nama: text("nama").notNull().unique(),
    deskripsi: text("deskripsi"),
    urutan: integer("urutan").default(0),
    aktif: boolean("aktif").default(true),
  },
  (table) => [uniqueIndex("kategori_masalah_nama_idx").on(table.nama)],
);

export const unitLayanan = pgTable(
  "unit_layanan",
  {
    id: serial("id").primaryKey(),
    nama: text("nama").notNull().unique(),
    deskripsi: text("deskripsi"),
    urutan: integer("urutan").default(0),
    aktif: boolean("aktif").default(true),
  },
  (table) => [uniqueIndex("unit_layanan_nama_idx").on(table.nama)],
);

export type Sentimen = "positif" | "negatif" | "netral";
export type StatusAnalisis =
  | "menunggu"
  | "berjalan"
  | "selesai"
  | "gagal"
  | "berhenti";
export type StatusTindakLanjut = "baru" | "dalam_koordinasi" | "selesai";
export type UnitLayanan =
  | "IGD"
  | "Farmasi"
  | "Poliklinik/Dokter"
  | "Rawat Inap"
  | "Kasir/BPJS"
  | "Fasilitas & Parkir"
  | "Lainnya";
export type KategoriMasalah =
  | "Waktu Tunggu"
  | "Keramahan Staf"
  | "Kebersihan"
  | "Akurasi Administrasi"
  | "Kompetensi Medis"
  | "Lainnya";

export type AnalisisRow = typeof analisis.$inferSelect;
export type UlasanRow = typeof ulasan.$inferSelect;
export type RumahSakitRow = typeof rumahSakit.$inferSelect;
export type SinkronLogRow = typeof sinkronLog.$inferSelect;