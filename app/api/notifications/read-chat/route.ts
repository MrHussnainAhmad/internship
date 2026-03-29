import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ email: session.user.email }, { projection: { _id: 1 } });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.collection("notifications").updateMany(
    { userId: user._id, type: "chat_message", isRead: false },
    { $set: { isRead: true } }
  );

  return NextResponse.json({ ok: true });
}
