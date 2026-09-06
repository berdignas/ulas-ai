import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("ulas_ai_session");

    if (sessionCookie?.value) {
      // Hapus session dari database jika ada
      try {
        await supabase
          .from("admin_session")
          .delete()
          .eq("id", sessionCookie.value);
      } catch {
        // Abaikan jika tabel belum ada
      }
    }

    // Buat response dan hapus cookie di browser
    const response = NextResponse.json({ sukses: true });
    response.cookies.set("ulas_ai_session", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });

    return response;
  } catch (err) {
    console.error("[auth/logout] unexpected error:", err);
    return NextResponse.json(
      { sukses: false, pesan: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
