"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  positif: number;
  negatif: number;
  netral: number;
}

const DATA_WARNA = [
  { key: "positif", warna: "#10b981" },
  { key: "netral", warna: "#fbbf24" },
  { key: "negatif", warna: "#f43f5e" },
];

export function SentimenDonut({ positif, negatif, netral }: Props) {
  const data = DATA_WARNA.map(({ key, warna }) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: key === "positif" ? positif : key === "negatif" ? negatif : netral,
    warna,
  })).filter((d) => d.value > 0);

  const total = positif + negatif + netral;

  if (total === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Belum ada data sentimen untuk ditampilkan.
      </div>
    );
  }

  return (
    <div className="relative h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={85}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.warna} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`${value} ulasan`]}
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-semibold tabular-nums">{total}</span>
        <span className="text-xs text-muted-foreground">ulasan terlabel</span>
      </div>
    </div>
  );
}
