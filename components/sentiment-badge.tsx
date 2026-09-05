import { Badge } from "@/components/ui/badge";

const MAP: Record<string, { label: string; variant: "success" | "warning" | "danger" | "secondary" }> = {
  positif: { label: "Positif", variant: "success" },
  netral: { label: "Netral", variant: "warning" },
  negatif: { label: "Negatif", variant: "danger" },
};

export function SentimentBadge({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const key = (value ?? "").toLowerCase();
  const meta = MAP[key] ?? { label: value ?? "—", variant: "secondary" as const };
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.label}
    </Badge>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = (status ?? "").toLowerCase();
  const map: Record<string, { label: string; variant: "success" | "warning" | "danger" | "secondary" | "default" }> = {
    selesai: { label: "Selesai", variant: "success" },
    berjalan: { label: "Berjalan", variant: "default" },
    menunggu: { label: "Menunggu", variant: "secondary" },
    gagal: { label: "Gagal", variant: "danger" },
    berhenti: { label: "Dihentikan", variant: "warning" },
  };
  const meta = map[key] ?? { label: status ?? "—", variant: "secondary" as const };
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.label}
    </Badge>
  );
}
