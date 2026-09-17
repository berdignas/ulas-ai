import crypto from "crypto";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const SESSION_COOKIE = "ulas_ai_session";
export const USER_ROLES = ["admin", "pkrs", "pengaduan"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type AuthUser = {
  id: number;
  username: string;
  role: UserRole;
};

export function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function normalizeRole(value: unknown): UserRole {
  return USER_ROLES.includes(value as UserRole) ? value as UserRole : "admin";
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const { data: session, error: sessionError } = await supabase
      .from("admin_session")
      .select("admin_id")
      .eq("id", token)
      .gt("kedaluwarsa_pada", new Date().toISOString())
      .maybeSingle();
    if (sessionError || !session) return null;

    const { data: adminData, error: adminError } = await supabase
      .from("admin")
      .select("id, username, role")
      .eq("id", session.admin_id)
      .maybeSingle();
    // Selama migrasi belum dijalankan, akun lama tetap bisa masuk sebagai admin.
    let admin = adminData;
    if (adminError) {
      const fallback = await supabase
        .from("admin")
        .select("id, username")
        .eq("id", session.admin_id)
        .maybeSingle();
      admin = fallback.data ? { ...fallback.data, role: "admin" } : null;
    }
    if (!admin) return null;

    return {
      id: admin.id,
      username: admin.username,
      role: normalizeRole(admin.role),
    };
  } catch {
    return null;
  }
}

export function isAdmin(user: AuthUser | null | undefined) {
  return user?.role === "admin";
}
