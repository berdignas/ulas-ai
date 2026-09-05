"use client";

import { formatTanggal, type AnalisisItem } from "@/lib/types";

interface Props {
  daftar: AnalisisItem[];
  dipilih: number | null;
  onChange: (id: number) => void;
  hanyaSelesai?: boolean;
}

export function PilihPeriode({ daftar, dipilih, onChange, hanyaSelesai = true }: Props) {
  const opsi = hanyaSelesai ? daftar.filter((a) => a.status === "selesai") : daftar;

  return (
    <select
      value={dipilih ?? ""}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-9 w-full max-w-sm rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {opsi.length === 0 && <option value="">Belum ada periode analisis</option>}
      {opsi.map((item) => (
        <option key={item.id} value={item.id}>
          {formatTanggal(item.tanggalUnggah)} · {item.namaFile} ({item.totalUlasan} ulasan)
        </option>
      ))}
    </select>
  );
}
