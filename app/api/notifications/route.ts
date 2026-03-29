import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();

  const notifications = await db
    .collection("notifications")
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  const unreadCount = await db
    .collection("notifications")
    .countDocuments({ userId: user._id, isRead: false });

  return NextResponse.json({
    unreadCount,
    items: notifications.map((item) => ({
      id: item._id.toString(),
      type: String(item.type ?? ""),
      title: String(item.title ?? ""),
      body: String(item.body ?? ""),
      link: String(item.link ?? ""),
      isRead: Boolean(item.isRead),
      createdAt: new Date(item.createdAt ?? Date.now()).toISOString(),
    })),
  });
}
