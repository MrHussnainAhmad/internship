import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { getDb } from "@/lib/db";
import { createMobileAccessToken } from "@/lib/mobile-token";
import { requireEnv } from "@/lib/env";

// Accept tokens issued to the web client ID as well as any additional
// native client IDs you configure via env vars.
function buildAudiences(): string[] {
  const ids: string[] = [];

  // Web / server-side client ID (always present)
  const webId = requireEnv("GOOGLE_CLIENT_ID");
  ids.push(webId);

  // Optional Android client ID
  const androidId = process.env.GOOGLE_ANDROID_CLIENT_ID;
  if (androidId) ids.push(androidId);

  // Optional iOS client ID
  const iosId = process.env.GOOGLE_IOS_CLIENT_ID;
  if (iosId) ids.push(iosId);

  return ids;
}

export async function POST(request: Request) {
  // ── 1. Parse body ────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { idToken } = (body ?? {}) as { idToken?: unknown };
  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid idToken" },
      { status: 400 }
    );
  }

  // ── 2. Verify Google idToken ──────────────────────────────────────────────
  const audiences = buildAudiences();
  const client = new OAuth2Client();

  let email: string;
  let googleId: string;
  let name: string | undefined;
  let picture: string | undefined;

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: audiences,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      return NextResponse.json(
        { error: "Empty token payload" },
        { status: 401 }
      );
    }

    if (!payload.email_verified) {
      return NextResponse.json(
        { error: "Google account email is not verified" },
        { status: 401 }
      );
    }

    email = payload.email!;
    googleId = payload.sub;
    name = payload.name;
    picture = payload.picture;
  } catch {
    return NextResponse.json(
      { error: "idToken verification failed" },
      { status: 401 }
    );
  }

  // ── 3. Find or create user in MongoDB ────────────────────────────────────
  const db = await getDb();
  const users = db.collection("users");

  // Look up by email (primary) or googleId
  let user = await users.findOne(
    { $or: [{ email }, { googleId }] },
    { projection: { _id: 1, email: 1, role: 1, username: 1 } }
  );

  if (!user) {
    // Auto-create the user (same pattern as NextAuth sign-in)
    const result = await users.insertOne({
      email,
      googleId,
      name: name ?? "",
      image: picture ?? "",
      role: null,           // user will pick their role on first open
      username: null,
      createdAt: new Date(),
    });
    user = await users.findOne(
      { _id: result.insertedId },
      { projection: { _id: 1, email: 1, role: 1, username: 1 } }
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }

  // ── 4. Issue our application JWT ─────────────────────────────────────────
  const token = createMobileAccessToken({
    sub: user._id.toString(),
    email: String(user.email ?? ""),
    role:
      user.role === "student" || user.role === "company"
        ? user.role
        : undefined,
    username: user.username ? String(user.username) : undefined,
  });

  return NextResponse.json({ token });
}
