import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ loggedIn: false });
    return Response.json({
      loggedIn: true,
      adminId: user.id,
      username: user.username,
      role: user.role,
      isAdmin: user.role === "admin",
    });
  } catch (err) {
    console.error("[auth/me] unexpected error:", err);
    return Response.json({ loggedIn: false });
  }
}
