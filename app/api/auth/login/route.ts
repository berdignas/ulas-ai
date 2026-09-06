import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";

// Gunakan Node.js runtime agar crypto tersedia
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return Response.json(
        { sukses: false, pesan: "Username dan password wajib diisi." },
        { status: 400 }
      );
    }

    // Cek apakah kredensial default admin/admin
    const isDefaultAdmin = username === "admin" && password === "admin";
    let adminId = 1;
    let isValid = isDefaultAdmin;

    if (!isDefaultAdmin) {
      // Hash password dengan SHA-256
      const passwordHash = crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");

      // Cari admin dengan username & hash yang cocok di DB
      try {
        const { data: admin } = await supabase
          .from("admin")
          .select("id, username")
          .eq("username", username)
          .eq("password_hash", passwordHash)
          .maybeSingle();

        if (admin) {
          isValid = true;
          adminId = admin.id;
        }
      } catch {
        // Abaikan jika tabel belum ada
      }
    }

    if (!isValid) {
      return Response.json(
        { sukses: false, pesan: "Username atau password salah." },
        { status: 401 }
      );
    }

    // Buat session token (UUID v4)
    const sessionToken = crypto.randomUUID();

    // Kedaluwarsa 7 hari dari sekarang
    const kedaluwarsa = new Date();
    kedaluwarsa.setDate(kedaluwarsa.getDate() + 7);

    // Simpan session ke DB jika tabel tersedia (non-blocking jika belum dimigrasi)
    try {
      await supabase
        .from("admin_session")
        .insert({
          id: sessionToken,
          admin_id: adminId,
          kedaluwarsa_pada: kedaluwarsa.toISOString(),
        });

      await supabase
        .from("admin")
        .update({ terakhir_login: new Date().toISOString() })
        .eq("id", adminId);
    } catch {
      // Abaikan jika tabel admin_session belum dibuat di Supabase
    }

    // Buat response dan set cookie ulas_ai_session
    const response = NextResponse.json({ sukses: true });
    response.cookies.set("ulas_ai_session", sessionToken, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 hari dalam detik
      sameSite: "lax",
    });

    return response;
  } catch (err) {
    console.error("[auth/login] unexpected error:", err);
    return NextResponse.json(
      { sukses: false, pesan: "Terjadi kesalahan server: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
