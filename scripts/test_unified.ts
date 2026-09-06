import { getEnvGemini } from "../lib/ai";

const sampleReview = "Di ruang bedah anggrek Pelayanan baik, petugasnya ramah dan baik, ruangannya nyaman tapi obat di farmasi agak lama antrenya.";

async function testUnifiedPrompt() {
  const { apiKey, model } = getEnvGemini();

  const prompt = `Anda adalah analis mutu pelayanan rumah sakit yang memproses ulasan Google Maps berbahasa Indonesia.
Tugas Anda: mengekstrak informasi terstruktur secara spesifik.

ATURAN:
1. unitLayanan: SATU dari ["IGD", "Farmasi", "Poliklinik/Dokter", "Rawat Inap", "Kasir/BPJS", "Fasilitas & Parkir", "Lainnya"]
2. kategoriMasalah: SATU dari ["Waktu Tunggu", "Keramahan Staf", "Kebersihan", "Akurasi Administrasi", "Kompetensi Medis", "Lainnya"]
3. sentimen: SATU dari ["positif", "negatif", "netral"]
4. faktorUrgensiMedis: boolean (true hanya jika malapraktik, bahaya nyawa, krisis fatal)
5. saranDrafBalasan: string draf respons resmi perwakilan RS (maks 3 kalimat)
6. aspek: array aspek spesifik yang disebutkan, masing-masing:
   - aspek: frasa singkat huruf kecil (contoh: "kebersihan kamar", "keramahan staf", "waktu tunggu obat", "kenyamanan ruangan")
   - sentimen: "positif" | "negatif" | "netral"
   - kutipan: potongan singkat teks asli maks 100 karakter

Balas HANYA JSON valid:
{
  "unitLayanan": string,
  "kategoriMasalah": string,
  "sentimen": string,
  "faktorUrgensiMedis": boolean,
  "saranDrafBalasan": string,
  "kepercayaan": number,
  "aspek": [
    { "aspek": string, "sentimen": string, "kutipan": string }
  ]
}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt }] },
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
      contents: [{ parts: [{ text: JSON.stringify({ rating: 4, ulasan: sampleReview }) }] }]
    })
  });

  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Data:", JSON.stringify(data, null, 2));
}

testUnifiedPrompt().catch(console.error);
