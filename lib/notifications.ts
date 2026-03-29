import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

type NotificationInput = {
  userId: ObjectId;
  type: string;
  title: string;
  body: string;
  link?: string;
};

export async function createNotification(input: NotificationInput) {
  const db = await getDb();
  await db.collection("notifications").insertOne({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link ?? "",
    isRead: false,
    createdAt: new Date(),
  });
}

export async function getUnreadNotificationCount(userId: ObjectId) {
  const db = await getDb();
  return db.collection("notifications").countDocuments({ userId, isRead: false });
}
