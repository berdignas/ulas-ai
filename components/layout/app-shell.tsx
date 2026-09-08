"use client";

import { useState, useEffect, type ReactNode, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CaretDown,
  ChartLine,
  Chats,
  ClipboardText,
  Cpu,
  Download,
  Gear,
  Globe,
  House,
  SignOut,
  Tag,
  UploadSimple,
  User,
} from "@phosphor-icons/react";
import type { IconProps } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  { href: "/export", label: "Ekspor Laporan", icon: Download, step: 4 },
  { href: "/pengaturan", label: "Pengaturan RS", icon: Gear, step: 5 },
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

  const [aiModelName, setAiModelName] = useState("Memuat model…");
  const [aiModelConfigured, setAiModelConfigured] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      const savedModel = localStorage.getItem("ulas_ai_model");
      try {
        const res = await fetch("/api/ai/models");
        const data = await res.json() as {
          defaultModel?: string;
          models?: Array<{ id: string; label: string; configured: boolean }>;
        };
        const active = data.models?.find((model) => model.id === (savedModel || data.defaultModel));
        setAiModelName(active?.label ?? savedModel ?? data.defaultModel ?? "Belum dipilih");
        setAiModelConfigured(Boolean(active?.configured));
      } catch {
        setAiModelName(savedModel ?? "Status tidak tersedia");
        setAiModelConfigured(false);
      }
    }
    void loadConfig();
    const handleConfigUpdated = () => void loadConfig();
    window.addEventListener("ulas_ai_config_updated", handleConfigUpdated);
    return () => window.removeEventListener("ulas_ai_config_updated", handleConfigUpdated);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    window.location.href = "/login";
  };

  // Jangan render sidebar dan header ketika di halaman login
  if (pathname === "/login") {
    return <>{children}</>;
  }

  const current = NAV_ITEMS.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  return (
    <div className="min-h-[100dvh]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex items-center justify-center px-5 pt-6 pb-5">
          <img src="/logo ulas ai.svg" alt="Ulas AI" />
        </div>
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.href} {...item} />
          ))}
        </nav>
        <div className="border-t border-border px-3 py-3 space-y-2">
          <button
            onClick={handleLogout}
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
          >
            <SignOut className="size-4 shrink-0" weight="regular" />
            <span>Keluar (Logout)</span>
          </button>
          <div className="px-2 pt-1 border-t border-border/50">
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              UlasAI &middot; AI Gateway
              <br />
              Analisis Sentimen Ulasan RS
            </p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
            {/* Left: Current Page Context & Mobile Logo */}
            <div className="flex min-w-0 items-center gap-3">
              <img src="/logo ulas ai.svg" alt="Ulas AI" className="h-7 w-auto lg:hidden" />
              <h2 className="hidden text-sm font-semibold tracking-tight text-foreground lg:block">
                {current?.label ?? "Ulas AI"}
              </h2>
            </div>

            {/* Right: Model AI Connection Status, Apify Status, and User Profile Dropdown */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Status Indicators Group */}
              <div className="flex items-center gap-2.5 sm:gap-3.5 rounded-full border border-border/80 bg-muted/40 px-3.5 py-1.5 text-xs shadow-2xs">
                {/* Model AI Connection Status */}
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2 shrink-0">
                    {aiModelConfigured && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                    <span className={cn("relative inline-flex size-2 rounded-full", aiModelConfigured ? "bg-emerald-500" : "bg-amber-500")} />
                  </span>
                  <span className="hidden text-muted-foreground md:inline">Model AI:</span>
                  <span className="font-semibold text-foreground">{aiModelName}</span>
                  <Badge variant="outline" className={cn(
                    "hidden sm:inline-flex text-[10px] py-0 px-1.5 font-medium",
                    aiModelConfigured
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-700 border-amber-500/30"
                  )}>
                    {aiModelConfigured ? "Siap" : "Belum siap"}
                  </Badge>
                </div>

                <Separator orientation="vertical" className="h-4 bg-border/80" />

                {/* APIFY API Connection Status */}
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-muted-foreground">Apify API:</span>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] py-0 px-1.5 font-medium">
                    Terhubung
                  </Badge>
                </div>
              </div>

              <Separator orientation="vertical" className="hidden sm:block h-5 bg-border/80" />

              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 rounded-full border border-border/80 bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-all duration-200 hover:bg-accent hover:border-border shadow-2xs focus:outline-hidden">
                    <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[11px] tracking-wider">
                      BD
                    </div>
                    <span className="hidden sm:inline font-medium">Bagoes Dev</span>
                    <CaretDown className="size-3.5 text-muted-foreground opacity-70" weight="bold" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1.5">
                  <div className="px-2 py-2">
                    <p className="text-xs font-semibold text-foreground">Bagoes Dev</p>
                    <p className="text-[11px] text-muted-foreground truncate">bagoesdev@ulas.ai</p>
                    <div className="mt-1.5">
                      <Badge variant="secondary" className="text-[10px] font-normal px-2 py-0.5">
                        Admin Pengelola RS
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/pengaturan" className="flex items-center gap-2">
                      <Gear className="size-4" weight="regular" />
                      <span>Pengaturan RS</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/jurnal" className="flex items-center gap-2">
                      <ClipboardText className="size-4" weight="regular" />
                      <span>Jurnal Harian</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30"
                  >
                    <SignOut className="size-4" weight="regular" />
                    <span>Keluar</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
