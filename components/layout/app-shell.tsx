"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartLine,
  Chats,
  ClipboardText,
  Download,
  Gear,
  House,
  Tag,
  UploadSimple,
} from "@phosphor-icons/react";
import type { IconProps } from "@phosphor-icons/react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
  step: number | null;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: House, step: null },
  { href: "/jurnal", label: "Jurnal Harian", icon: ClipboardText, step: 2 },
  { href: "/unggah", label: "Unggah Data", icon: UploadSimple, step: 1 },
  { href: "/ulasan", label: "Daftar Ulasan", icon: Chats, step: 2 },
  { href: "/aspek", label: "Analisis Aspek", icon: Tag, step: 3 },
  { href: "/tren", label: "Pemantauan Tren", icon: ChartLine, step: 4 },
  { href: "/export", label: "Ekspor Laporan", icon: Download, step: 5 },
  { href: "/pengaturan", label: "Pengaturan RS", icon: Gear, step: 6 },
];

function SidebarLink({ href, label, icon: Icon, step }: NavItem) {
  const pathname = usePathname();
  const aktif = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
        aktif
          ? "bg-zinc-900 text-zinc-50"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="size-[18px] shrink-0" weight="regular" />
      <span className="flex-1">{label}</span>
      {step !== null && (
        <span
          className={cn(
            "font-mono text-[11px]",
            aktif ? "text-zinc-500" : "text-zinc-400"
          )}
        >
          {String(step).padStart(2, "0")}
        </span>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  return (
    <div className="min-h-[100dvh]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex items-center justify-center px-5 pt-6 pb-5">
          <img src="/logo ulas ai.svg" alt="Ulas AI"/>
        </div>
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.href} {...item} />
          ))}
        </nav>
        <div className="border-t border-border px-5 py-4">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            UlasAI &middot; AI Gateway
            <br />
            Analisis Sentimen Ulasan Google Maps
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-sm">
          <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/logo ulas ai.svg" alt="Ulas AI" className="h-7 w-auto lg:hidden" />
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden">
            {NAV_ITEMS.map((item) => {
              const aktif = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    aktif
                      ? "bg-zinc-900 text-zinc-50"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
