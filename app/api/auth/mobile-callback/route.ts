import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createMobileAccessToken } from "@/lib/mobile-token";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUrl = url.searchParams.get("redirectUrl");
  if (!redirectUrl) {
    return NextResponse.json({ error: "Missing redirectUrl" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne(
    { email: session.user.email },
    { projection: { _id: 1, email: 1, role: 1, username: 1 } }
  );
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const token = createMobileAccessToken({
    sub: user._id.toString(),
    email: String(user.email ?? ""),
    role:
      user.role === "student" || user.role === "company"
        ? user.role
        : undefined,
    username: user.username ? String(user.username) : undefined,
  });

  const target = new URL(redirectUrl);
  target.searchParams.set("token", token);
  return NextResponse.redirect(target.toString());
}
