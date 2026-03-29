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
    .regex(/^[a-z0-9_]{3,20}$/),
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
    user: {
      id: user._id.toString(),
      email: String(user.email),
      name: String(user.name ?? ""),
      username: user.username ? String(user.username) : "",
      role: user.role ? String(user.role) : "",
      image: user.image ? String(user.image) : "",
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

  const { name, username, role } = parsed.data;

  await ensureIndexes();
  const db = await getDb();
  const users = db.collection("users");
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

  await users.updateOne(
    { _id: currentUser._id },
    {
      $set: {
        name,
        username,
        role,
        updatedAt: new Date(),
      },
    }
  );

  return NextResponse.json({ ok: true });
}
