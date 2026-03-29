import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const schema = z.object({
  targetUserId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success || !ObjectId.isValid(parsed.data.targetUserId)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const db = await getDb();
  const currentUser = await db
    .collection("users")
    .findOne({ email: session.user.email }, { projection: { _id: 1 } });
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetId = new ObjectId(parsed.data.targetUserId);
  if (targetId.toString() === currentUser._id.toString()) {
    return NextResponse.json({ error: "You cannot connect to yourself" }, { status: 400 });
  }

  const key = {
    fromUserId: currentUser._id,
    toUserId: targetId,
  };

  const deleteResult = await db.collection("connections").deleteOne(key);
  if (deleteResult.deletedCount === 1) {
    return NextResponse.json({
      ok: true,
      connected: false,
    });
  }

  try {
    await db.collection("connections").insertOne({
      ...key,
      createdAt: new Date(),
    });
  } catch {
    return NextResponse.json({
      ok: true,
      connected: true,
    });
  }

  return NextResponse.json({
    ok: true,
    connected: true,
  });
}
