import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("ulas_ai_session");

    if (!sessionCookie?.value) {
      return Response.json({ loggedIn: false });
    }

    // Cek session di database: harus ada & belum kedaluwarsa
    const now = new Date().toISOString();
    const { data: session, error } = await supabase
      .from("admin_session")
      .select("id, admin_id, kedaluwarsa_pada")
      .eq("id", sessionCookie.value)
      .gt("kedaluwarsa_pada", now)
      .single();

    if (error || !session) {
      return Response.json({ loggedIn: false });
    }

    return Response.json({ loggedIn: true, adminId: session.admin_id });
  } catch (err) {
    console.error("[auth/me] unexpected error:", err);
    return Response.json({ loggedIn: false });
  }
}
