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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await getCurrentUser();
  if (!current || !isAdmin(current)) return unauthorized();
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID akun tidak valid." }, { status: 400 });

  try {
    const body = await req.json() as { username?: string; password?: string; role?: string };
    const update: Record<string, string> = {};
    if (body.username !== undefined) {
      const username = String(body.username).trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) return NextResponse.json({ error: "Username tidak valid." }, { status: 400 });
      update.username = username;
    }
    if (body.password !== undefined && body.password !== "") {
      if (body.password.length < 8) return NextResponse.json({ error: "Password minimal 8 karakter." }, { status: 400 });
      update.password_hash = hashPassword(body.password);
    }
    if (body.role !== undefined) {
      if (!validRole(body.role)) return NextResponse.json({ error: "Role tidak valid." }, { status: 400 });
      if (current.id === id && body.role !== "admin") return NextResponse.json({ error: "Akun yang sedang dipakai tidak boleh diturunkan dari admin." }, { status: 400 });
      update.role = body.role;
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: "Tidak ada perubahan." }, { status: 400 });

    if (update.role && update.role !== "admin") {
      const { count } = await supabase.from("admin").select("id", { count: "exact", head: true }).eq("role", "admin");
      const target = await supabase.from("admin").select("role").eq("id", id).maybeSingle();
      if (target.data?.role === "admin" && (count ?? 0) <= 1) return NextResponse.json({ error: "Minimal harus ada satu admin." }, { status: 400 });
    }

    const { data, error } = await supabase.from("admin").update(update).eq("id", id)
      .select("id, username, role, dibuat_pada, terakhir_login").single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Username sudah digunakan." }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ user: data });
  } catch {
    return NextResponse.json({ error: "Data akun tidak valid." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const current = await getCurrentUser();
  if (!current || !isAdmin(current)) return unauthorized();
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID akun tidak valid." }, { status: 400 });
  if (current.id === id) return NextResponse.json({ error: "Akun yang sedang dipakai tidak dapat dihapus." }, { status: 400 });

  const target = await supabase.from("admin").select("role").eq("id", id).maybeSingle();
  if (target.data?.role === "admin") {
    const { count } = await supabase.from("admin").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) return NextResponse.json({ error: "Minimal harus ada satu admin." }, { status: 400 });
  }
  const { error } = await supabase.from("admin").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
