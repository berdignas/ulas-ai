import { normalisasiAspekUmum } from "@/lib/service-taxonomy";

export type SummaryReview = {
  id: number;
  rating: number | null;
  teks_ulasan: string;
  tanggal_ulasan: string | null;
  sentimen: string | null;
  sumber_label: string | null;
  unit_layanan: string | null;
  faktor_urgensi_medis: boolean | null;
  hasil_aspek_ulasans: Array<{
    sentimen_aspek: string;
    aspek: { nama_aspek: string } | null;
  }>;
};

export function summarizeHospital(name: string, reviews: SummaryReview[]) {
  const counts = { positif: 0, netral: 0, negatif: 0 };
  const praise = new Map<string, number>();
  const complaints = new Map<string, number>();
  const units = new Map<string, number>();
  const examples: Array<{ id: number; sentimen: string; teks: string }> = [];
  let ratingTotal = 0;
  let rated = 0;
  let ai = 0;
  let ratingFallback = 0;
  let urgent = 0;

  for (const review of reviews) {
    if (typeof review.rating === "number" && Number.isFinite(review.rating) && review.rating >= 1 && review.rating <= 5) {
      ratingTotal += review.rating;
      rated++;
    }
    if (!Object.hasOwn(counts, review.sentimen ?? "")) continue;
    const sentiment = review.sentimen as keyof typeof counts;
    counts[sentiment]++;
    if (review.sumber_label === "ai") ai++;
    if (review.sumber_label === "rating") ratingFallback++;
    if (review.faktor_urgensi_medis && review.sumber_label === "ai") urgent++;
    if (review.sumber_label === "ai" && sentiment === "negatif" && review.unit_layanan && review.unit_layanan !== "Lainnya") {
      units.set(review.unit_layanan, (units.get(review.unit_layanan) ?? 0) + 1);
    }
    // Rating fallback provides no evidence about individual service aspects.
    if (review.sumber_label !== "ai") continue;
    const seen = new Set<string>();
    for (const aspect of review.hasil_aspek_ulasans ?? []) {
      if (!aspect.aspek?.nama_aspek || !["positif", "negatif"].includes(aspect.sentimen_aspek)) continue;
      const aspectName = normalisasiAspekUmum(aspect.aspek.nama_aspek);
      const key = `${aspectName}:${aspect.sentimen_aspek}`;
      if (aspectName === "Lainnya" || seen.has(key)) continue;
      seen.add(key);
      const target = aspect.sentimen_aspek === "positif" ? praise : complaints;
      target.set(aspectName, (target.get(aspectName) ?? 0) + 1);
    }
    const text = review.teks_ulasan?.trim();
    if (text && text.length >= 20 && ["positif", "negatif"].includes(sentiment) && !examples.some((item) => item.sentimen === sentiment)) {
      examples.push({ id: review.id, sentimen: sentiment, teks: text.length > 280 ? `${text.slice(0, 280)}…` : text });
    }
  }

  const analyzed = counts.positif + counts.netral + counts.negatif;
  const pending = reviews.length - analyzed;
  const top = (map: Map<string, number>) => [...map].map(([nama, jumlah]) => ({ nama, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama, "id")).slice(0, 3);
  const strengths = top(praise);
  const concerns = top(complaints);
  const complaintUnits = top(units);
  const number = (value: number) => value.toLocaleString("id-ID");
  const percentage = (value: number) => (value / analyzed * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 });
  const list = (items: typeof strengths) => items.map((item) => `${item.nama} (${number(item.jumlah)} ulasan)`).join(", ");
  const paragraphs: string[] = [];

  if (analyzed === 0) {
    paragraphs.push(`Belum ada ulasan ${name} yang selesai diklasifikasikan. Kondisi layanan belum dapat dirangkum dari sentimen atau aspek layanan.`);
  } else {
    const max = Math.max(...Object.values(counts));
    const leaders = Object.entries(counts).filter(([, count]) => count === max).map(([key]) => key);
    const assessment = leaders.length > 1
      ? `Penilaian terbagi antara sentimen ${leaders.join(" dan ")} dengan jumlah yang sama.`
      : max > analyzed / 2
        ? `Mayoritas ulasan yang sudah diklasifikasikan bernada ${leaders[0]}.`
        : `Sentimen ${leaders[0]} paling banyak ditemukan, tetapi belum mencakup mayoritas ulasan yang sudah diklasifikasikan.`;
    paragraphs.push(`${assessment} Dari ${number(analyzed)} ulasan ${name} yang sudah diklasifikasikan, ${number(counts.positif)} (${percentage(counts.positif)}%) positif, ${number(counts.netral)} (${percentage(counts.netral)}%) netral, dan ${number(counts.negatif)} (${percentage(counts.negatif)}%) negatif.`);
    if (strengths.length) paragraphs.push(`Aspek yang paling sering mendapat pujian adalah ${list(strengths)}. Pujian pada aspek ini menjadi dasar untuk mempertahankan pengalaman layanan yang dinilai positif oleh pengulas.`);
    if (concerns.length) {
      let concern = `Keluhan paling sering berkaitan dengan ${list(concerns)}. Aspek tersebut perlu diprioritaskan untuk peninjauan dan tindak lanjut.`;
      if (complaintUnits.length) concern += ` Di antara ulasan negatif yang unit layanannya teridentifikasi, unit yang paling sering disebut adalah ${list(complaintUnits)}.`;
      paragraphs.push(concern);
    }
    if (!strengths.length && !concerns.length) paragraphs.push("Belum ada hasil analisis aspek yang cukup spesifik untuk menjelaskan apa yang dipuji atau dikeluhkan. Sentimen saja belum menjelaskan kualitas tiap layanan.");
    if (urgent) paragraphs.push(`${number(urgent)} ulasan ditandai AI sebagai indikasi urgensi medis dan perlu diverifikasi petugas. Penandaan ini bukan konfirmasi kejadian medis.`);
  }
  if (rated) paragraphs.push(`Rata-rata rating pada ${number(rated)} ulasan yang tersimpan adalah ${(ratingTotal / rated).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} dari 5 bintang.`);
  if (pending) paragraphs.push(`Masih ada ${number(pending)} dari ${number(reviews.length)} ulasan yang belum diklasifikasikan; ringkasan sentimen belum mencakup ulasan tersebut.`);
  if (ratingFallback) paragraphs.push(`${number(ratingFallback)} label sentimen berasal dari rating bintang, sehingga tidak digunakan untuk menyimpulkan pujian atau keluhan pada aspek tertentu.`);

  return {
    paragraphs, total: reviews.length, analyzed, pending, counts, ai, ratingFallback,
    averageRating: rated ? ratingTotal / rated : null, rated, strengths, concerns,
    complaintUnits, urgent, examples,
  };
}
