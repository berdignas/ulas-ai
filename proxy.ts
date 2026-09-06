/**
 * proxy.ts — Ulas AI v3
 *
 * Melindungi seluruh route aplikasi kecuali:
 * - /login dan semua path di bawahnya
 * - /api/auth/* (endpoint login/logout/me)
 * - Aset statis Next.js (_next/static, _next/image, favicon.ico)
 *
 * Catatan: Di Next.js 16, file middleware.ts sudah deprecated dan
 * digantikan oleh proxy.ts dengan fungsi bernama `proxy`.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Izinkan akses ke halaman login, endpoint autentikasi, dan aset gambar publik
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".ico");

  const session = request.cookies.get("ulas_ai_session");

  // Jika bukan rute publik dan tidak ada session, redirect ke /login
  if (!isPublic && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Jika sudah login dan membuka /login, redirect ke dashboard
  if (pathname === "/login" && session?.value) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Cocokkan semua path kecuali:
     * - _next/static  (file statis Next.js)
     * - _next/image   (optimasi gambar)
     * - favicon.ico   (ikon browser)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
