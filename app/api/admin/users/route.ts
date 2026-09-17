import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword, isAdmin, USER_ROLES, type UserRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

function validRole(value: unknown): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

function unauthorized() {
  return NextResponse.json({ error: "Hanya admin yang dapat mengelola akun." }, { status: 403 });
}

export async function GET() {
  const current = await getCurrentUser();
  if (!current || !isAdmin(current)) return unauthorized();

  const { data, error } = await supabase
    .from("admin")
    .select("id, username, role, dibuat_pada, terakhir_login")
    .order("id", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

export async function POST(req: Request) {
  const current = await getCurrentUser();
  if (!current || !isAdmin(current)) return unauthorized();

  try {
    const body = await req.json() as { username?: string; password?: string; role?: string };
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = body.role;
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      return NextResponse.json({ error: "Username 3-40 karakter: huruf kecil, angka, titik, garis bawah, atau strip." }, { status: 400 });
    }
    if (password.length < 8) return NextResponse.json({ error: "Password minimal 8 karakter." }, { status: 400 });
    if (!validRole(role)) return NextResponse.json({ error: "Role tidak valid." }, { status: 400 });

    const { data, error } = await supabase.from("admin").insert({
      username,
      password_hash: hashPassword(password),
      role,
    }).select("id, username, role, dibuat_pada, terakhir_login").single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Username sudah digunakan." }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ user: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Data akun tidak valid." }, { status: 400 });
  }
}
