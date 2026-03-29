import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/api-auth";
import { getDb } from "@/lib/db";

const schema = z.object({
  notificationId: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success || !ObjectId.isValid(parsed.data.notificationId)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const db = await getDb();

  await db.collection("notifications").updateOne(
    {
      _id: new ObjectId(parsed.data.notificationId),
      userId: user._id,
      isRead: false,
    },
    { $set: { isRead: true } }
  );

  return NextResponse.json({ ok: true });
}
