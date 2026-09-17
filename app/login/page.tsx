"use client";

import { useState, type FormEvent } from "react";
import {
  User,
  Lock,
  Eye,
  EyeSlash,
  SpinnerGap,
  ArrowRight,
  ShieldCheck,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        window.location.href = "/";
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.pesan ?? "Username atau password salah.");
      }
    } catch {
      setError("Gagal terhubung ke server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-slate-100/90 dark:bg-zinc-950 p-4 sm:p-6 lg:p-10 font-sans">
      {/* Main Split Card Container */}
      <div className="w-full max-w-5xl rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2">
        {/* Left Column: Form Area */}
        <div className="p-8 sm:p-12 lg:p-14 flex flex-col justify-between space-y-8 bg-card">
          <div>
            {/* Header / Title (Tanpa Logo Ulas AI sesuai permintaan) */}
            <div className="space-y-1.5 mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Welcome Back
              </h1>
              <p className="text-sm text-muted-foreground">
                Silakan masukkan detail akun admin Anda untuk melanjutkan
              </p>
            </div>

            {/* Segmented Control Pill (Seperti pada referensi) */}
            <div className="mb-6 flex items-center rounded-xl bg-muted/60 p-1 border border-border/40">
              <button
                type="button"
                className="flex-1 rounded-lg bg-card py-2 text-xs font-semibold text-foreground shadow-xs transition-all text-center"
              >
                Sign In
              </button>
              <button
                type="button"
                disabled
                className="flex-1 rounded-lg py-2 text-xs font-medium text-muted-foreground opacity-60 text-center cursor-not-allowed"
              >
                Signup
              </button>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Field */}
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-medium text-muted-foreground">
                  Username
                </Label>
                <div className="relative flex items-center">
                  <User className="absolute left-3.5 size-4 text-muted-foreground pointer-events-none" weight="bold" />
                  <Input
                    id="username"
                    type="text"
                    autoComplete="username"
                    placeholder="Masukkan username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 pl-10 rounded-xl border-border/80 bg-background text-sm focus-visible:ring-primary/20"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                  Password
                </Label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 size-4 text-muted-foreground pointer-events-none" weight="bold" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 pl-10 pr-10 rounded-xl border-border/80 bg-background text-sm focus-visible:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    {showPassword ? (
                      <EyeSlash className="size-4" weight="bold" />
                    ) : (
                      <Eye className="size-4" weight="bold" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
                  <ShieldCheck className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Continue Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg shadow-blue-500/25 active:scale-[0.99] gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <SpinnerGap className="size-4 animate-spin" weight="bold" />
                    <span>Memproses…</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="size-4" weight="bold" />
                  </>
                )}
              </Button>
            </form>

            {/* Hint Akun Default */}
            <div className="mt-5 rounded-xl bg-muted/40 border border-border/30 p-3 text-center text-xs text-muted-foreground">
              Akun awal: <span className="font-mono font-semibold text-foreground">admin</span> /{" "}
              <span className="font-mono font-semibold text-foreground">adminrs123</span>
            </div>
          </div>

          {/* Footer Note (Seperti teks kecil di bawah referensi) */}
          <div className="pt-4 border-t border-border/40">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Platform intelijen analitik ulasan pasien dan mutu layanan rumah sakit berbasis AI. Kelola feedback secara terstruktur dan terukur.
            </p>
          </div>
        </div>

        {/* Right Column: Floating 3D ULAS AI Showcase (Tanpa background putih / card) */}
        <div className="relative hidden lg:flex flex-col items-center justify-center bg-gradient-to-b from-[#e3f1fd] via-[#d0e7fd] to-[#b4d8f8] dark:from-slate-950 dark:via-blue-950/70 dark:to-slate-900 p-8 xl:p-12 overflow-hidden border-l border-border/40 select-none">
          {/* Subtle vertical light bars / rain accents (seperti gambar referensi) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35">
            <div className="absolute top-10 left-[22%] w-[2.5px] h-24 bg-white rounded-full blur-[0.5px]" />
            <div className="absolute top-[35%] right-[20%] w-[2.5px] h-36 bg-white rounded-full blur-[0.5px]" />
            <div className="absolute bottom-16 left-[28%] w-[2px] h-24 bg-white/80 rounded-full blur-[0.5px]" />
            <div className="absolute bottom-28 right-[30%] w-[2.5px] h-28 bg-white/90 rounded-full blur-[0.5px]" />
          </div>

          {/* Glowing Aura & Floating 3D ULAS AI Container */}
          <div className="relative flex flex-col items-center justify-center w-full max-w-[360px]">
            {/* Ambient Cyan/Sky-Blue Pulsing Radial Glow */}
            <div className="absolute -inset-8 rounded-full bg-cyan-400/35 dark:bg-cyan-500/25 blur-3xl animate-pulse pointer-events-none" />
            <div className="absolute inset-4 rounded-full bg-blue-500/25 dark:bg-blue-600/20 blur-2xl pointer-events-none" />

            {/* Floating 3D Emblem */}
            <div className="relative z-10 w-full animate-float-slow">
              <img
                src="/ulas-ai-transparent.png"
                alt="ULAS AI 3D Glowing Shield"
                className="w-full h-auto object-contain pointer-events-none animate-glow-pulse select-none"
              />
            </div>

            {/* Dynamic Floor Shadow */}
            <div className="w-44 h-5 mt-2 rounded-[100%] bg-blue-950/20 dark:bg-black/50 blur-md animate-shadow-pulse pointer-events-none" />
          </div>

          {/* Subtitle / Caption */}
          <div className="relative z-10 mt-6 text-center space-y-1">
            <h3 className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-200">
              ULAS AI • Hospital Review Intelligence
            </h3>
            <p className="text-xs text-slate-600/90 dark:text-slate-400 max-w-xs leading-relaxed">
              Analisis rating dan sentimen ulasan rumah sakit secara otomatis dengan kecerdasan buatan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
