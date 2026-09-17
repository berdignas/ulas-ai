import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { hashPassword, SESSION_COOKIE, type UserRole } from "@/lib/auth";

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

    let { data: admin, error: adminError } = await supabase
      .from("admin")
      .select("id, username, password_hash, role")
      .eq("username", String(username).trim())
      .maybeSingle();

    if (adminError) {
      const fallback = await supabase
        .from("admin")
        .select("id, username, password_hash")
        .eq("username", String(username).trim())
        .maybeSingle();
      admin = fallback.data ? { ...fallback.data, role: "admin" } : null;
      adminError = fallback.error;
    }
    if (adminError) {
      console.error("[auth/login] database error:", adminError.message);
      return NextResponse.json({ sukses: false, pesan: "Autentikasi belum siap. Jalankan migrasi role akun terlebih dahulu." }, { status: 503 });
    }

    if (!admin || admin.password_hash !== hashPassword(password)) {
      return Response.json(
        { sukses: false, pesan: "Username atau password salah." },
        { status: 401 }
      );
    }

    const adminId = admin.id;
    const role = (admin.role || "admin") as UserRole;

    // Buat session token (UUID v4)
    const sessionToken = crypto.randomUUID();

    // Kedaluwarsa 7 hari dari sekarang
    const kedaluwarsa = new Date();
    kedaluwarsa.setDate(kedaluwarsa.getDate() + 7);

    const { error: sessionError } = await supabase
      .from("admin_session")
      .insert({
        id: sessionToken,
        admin_id: adminId,
        kedaluwarsa_pada: kedaluwarsa.toISOString(),
      });

    if (sessionError) {
      console.error("[auth/login] session error:", sessionError.message);
      return NextResponse.json(
        { sukses: false, pesan: "Sesi login gagal dibuat. Periksa tabel autentikasi." },
        { status: 503 }
      );
    }

    await supabase
      .from("admin")
      .update({ terakhir_login: new Date().toISOString() })
      .eq("id", adminId);

    // Buat response dan set cookie ulas_ai_session
    const response = NextResponse.json({ sukses: true, user: { username: admin.username, role } });
    response.cookies.set(SESSION_COOKIE, sessionToken, {
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
