import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { ensureIndexes } from "@/lib/indexes";

const roleSchema = z.enum(["student", "company"]);
const payloadSchema = z.object({
  name: z.string().trim().min(2).max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/)
    .optional(),
  bio: z.string().trim().max(500).optional(),
  role: roleSchema,
});

export async function GET(request: Request) {
  const currentUser = await getApiUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne(
    { _id: currentUser._id },
    {
      projection: {
        _id: 1,
        email: 1,
        name: 1,
        username: 1,
        role: 1,
        image: 1,
      },
    }
  );

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: user.name ? String(user.name) : null,
    role: user.role ? String(user.role) : null,
    user: {
      id: user._id.toString(),
      email: String(user.email),
      name: user.name ? String(user.name) : null,
      username: user.username ? String(user.username) : null,
      role: user.role ? String(user.role) : null,
      image: user.image ? String(user.image) : null,
    },
  });
}

export async function PUT(request: Request) {
  const currentUser = await getApiUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, username, bio, role } = parsed.data;

  await ensureIndexes();
  const db = await getDb();
  const users = db.collection("users");

  const existingUser = await users.findOne(
    { _id: currentUser._id },
    { projection: { _id: 1, username: 1, role: 1 } }
  );
  if (!existingUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const existingRole =
    existingUser.role === "student" || existingUser.role === "company"
      ? existingUser.role
      : null;
  const existingUsername =
    typeof existingUser.username === "string" && existingUser.username.trim()
      ? existingUser.username.trim().toLowerCase()
      : null;

  if (existingRole && role !== existingRole) {
    return NextResponse.json(
      { error: "Role cannot be changed once set" },
      { status: 409 }
    );
  }

  if (existingUsername && username && username !== existingUsername) {
    return NextResponse.json(
      { error: "Username cannot be changed once set" },
      { status: 409 }
    );
  }

  if (!existingUsername && !username) {
    return NextResponse.json(
      { error: "Username is required for first profile setup" },
      { status: 400 }
    );
  }

  if (username && !existingUsername) {
    const existing = await users.findOne({
      username,
      _id: { $ne: currentUser._id },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Username already in use" },
        { status: 409 }
      );
    }
  }

  const updateData: {
    name: string;
    role: "student" | "company";
    updatedAt: Date;
    username?: string;
    bio?: string;
  } = {
    name,
    role: existingRole ?? role,
    updatedAt: new Date(),
  };

  if (!existingUsername && username !== undefined) updateData.username = username;
  if (bio !== undefined) updateData.bio = bio;

  await users.updateOne(
    { _id: currentUser._id },
    { $set: updateData }
  );

  return NextResponse.json({ ok: true });
}
