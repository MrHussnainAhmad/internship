import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();

  await db.collection("notifications").updateMany(
    { userId: user._id, type: "chat_message", isRead: false },
    { $set: { isRead: true } }
  );

  return NextResponse.json({ ok: true });
}
