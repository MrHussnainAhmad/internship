import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const schema = z
  .object({
    scope: z.enum(["alerts", "chats", "all"]).optional(),
  })
  .optional();

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  const scope = parsed.success ? parsed.data?.scope ?? "alerts" : "alerts";

  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ email: session.user.email }, { projection: { _id: 1 } });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filter: Record<string, unknown> = { userId: user._id, isRead: false };
  if (scope === "alerts") {
    filter.type = { $ne: "chat_message" };
  } else if (scope === "chats") {
    filter.type = "chat_message";
  }
  await db.collection("notifications").updateMany(filter, { $set: { isRead: true } });

  return NextResponse.json({ ok: true });
}
