"use client";

import { useState, useEffect, type ReactNode, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CaretDown,
  Chats,
  ClipboardText,
  Download,
  Gear,
  House,
  List,
  SignOut,
  Tag,
  UploadSimple,
  UsersThree,
} from "@phosphor-icons/react";
import type { IconProps } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  { href: "/manajemen-akun", label: "Manajemen Akun", icon: UsersThree, step: null },
];

function SidebarLink({ href, label, icon: Icon, step }: NavItem) {
  const pathname = usePathname();
  const aktif = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={aktif ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
        aktif
          ? "bg-zinc-900 text-zinc-50"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="size-[18px] shrink-0" weight="regular" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      {step !== null && (
        <span
          aria-hidden="true"
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
  const router = useRouter();

  const [aiModelName, setAiModelName] = useState("Memuat model…");
  const [aiModelConfigured, setAiModelConfigured] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: "admin" | "pkrs" | "pengaduan" } | null>(null);

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

  useEffect(() => {
    let aktif = true;
    void fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { loggedIn?: boolean; username?: string; role?: "admin" | "pkrs" | "pengaduan" }) => {
        if (!aktif || !data.loggedIn || !data.username || !data.role) return;
        setCurrentUser({ username: data.username, role: data.role });
        if (data.role !== "admin" && (pathname.startsWith("/pengaturan") || pathname.startsWith("/manajemen-akun"))) {
          router.replace("/");
        }
      })
      .catch(() => undefined);
    return () => { aktif = false; };
  }, [pathname, router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    router.replace("/login");
    router.refresh();
  };

  // Jangan render sidebar dan header ketika di halaman login
  if (pathname === "/login") {
    return <>{children}</>;
  }

  const visibleNav = NAV_ITEMS.filter((item) =>
    currentUser?.role === "admin" || (item.href !== "/pengaturan" && item.href !== "/manajemen-akun")
  );

  const current = NAV_ITEMS.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  return (
    <div className="min-h-[100dvh]">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[60] rounded-lg bg-background px-4 py-3 text-sm font-semibold shadow-lg focus:not-sr-only focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Lewati navigasi
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center justify-center px-5">
          <Image src="/logo ulas ai.svg" alt="Ulas AI" width={125} height={50} priority />
        </div>
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {visibleNav.map((item) => (
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
              <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-2xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
                    aria-label="Buka menu navigasi"
                    aria-expanded={mobileMenuOpen}
                  >
                    <List className="size-5" weight="bold" aria-hidden="true" />
                  </button>
                </DialogTrigger>
                <DialogContent className="left-0 top-0 h-[100dvh] w-[min(88vw,320px)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-y-0 border-l-0 p-0 shadow-2xl data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:rounded-none [&>button]:right-3 [&>button]:top-2.5 [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-lg [&>button]:border [&>button]:border-border [&>button]:opacity-100">
                  <DialogHeader className="flex h-16 justify-center border-b border-border px-5 pr-16 text-left">
                    <DialogTitle>
                      <Image src="/logo ulas ai.svg" alt="Ulas AI" width={88} height={35} className="h-7 w-auto" />
                    </DialogTitle>
                    <DialogDescription className="sr-only">Menu utama aplikasi Ulas AI</DialogDescription>
                  </DialogHeader>

                  <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Navigasi utama">
                    {visibleNav.map((item) => {
                      const aktif = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          aria-current={aktif ? "page" : undefined}
                          className={cn(
                            "flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            aktif
                              ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          )}
                        >
                          <Icon className="size-5 shrink-0" weight={aktif ? "duotone" : "regular"} aria-hidden="true" />
                          <span className="flex-1">{item.label}</span>
                          {item.step !== null && <span className="font-mono text-[11px] opacity-60" aria-hidden="true">{String(item.step).padStart(2, "0")}</span>}
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="space-y-3 border-t border-border bg-muted/30 p-4">
                    <div className="rounded-xl border border-border bg-background p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Model AI</p>
                      <div className="mt-2 flex items-center gap-2 text-xs font-medium">
                        <span className={cn("size-2 rounded-full", aiModelConfigured ? "bg-emerald-500" : "bg-amber-500")} aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{aiModelName}</span>
                        <span className={cn("font-semibold", aiModelConfigured ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300")}>
                          {aiModelConfigured ? "Siap" : "Belum siap"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-950/40"
                    >
                      <SignOut className="size-5" aria-hidden="true" />
                      Keluar
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
              <Image src="/logo ulas ai.svg" alt="Ulas AI" width={88} height={35} className="h-7 w-auto lg:hidden" priority />
              <h2 className="hidden text-sm font-semibold tracking-tight text-foreground lg:block">
                {current?.label ?? "Ulas AI"}
              </h2>
            </div>

            {/* Right: Model AI Connection Status, Apify Status, and User Profile Dropdown */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Status Indicators Group */}
              <div className="hidden items-center gap-2.5 rounded-full border border-border/80 bg-muted/40 px-3.5 py-1.5 text-xs shadow-2xs sm:flex sm:gap-3.5">
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
                  <button className="flex min-h-11 items-center gap-2.5 rounded-full border border-border/80 bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-all duration-200 hover:bg-accent hover:border-border shadow-2xs focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[11px] tracking-wider">
                      {(currentUser?.username ?? "user").slice(0, 2).toUpperCase()}
                    </div>
                    <span className="hidden sm:inline font-medium">{currentUser?.username ?? "Pengguna"}</span>
                    <CaretDown className="size-3.5 text-muted-foreground opacity-70" weight="bold" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1.5">
                  <div className="px-2 py-2">
                    <p className="text-xs font-semibold text-foreground">{currentUser?.username ?? "Pengguna"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">Akun Ulas AI</p>
                    <div className="mt-1.5">
                      <Badge variant="secondary" className="text-[10px] font-normal px-2 py-0.5">
                        {currentUser?.role === "admin" ? "Admin Pengelola RS" : currentUser?.role === "pkrs" ? "PKRS" : "Pengaduan"}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {currentUser?.role === "admin" && <>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/pengaturan" className="flex items-center gap-2">
                        <Gear className="size-4" weight="regular" />
                        <span>Pengaturan RS</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/manajemen-akun" className="flex items-center gap-2">
                        <UsersThree className="size-4" weight="regular" />
                        <span>Manajemen Akun</span>
                      </Link>
                    </DropdownMenuItem>
                  </>}
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

        </header>

        <main id="main-content" className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
