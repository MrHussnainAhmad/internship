import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

const messageSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});

async function getAuthorizedChat(chatId: string, email: string) {
  if (!ObjectId.isValid(chatId)) return { error: "Invalid chat id", status: 400 };

  const db = await getDb();
  const currentUser = await db.collection("users").findOne(
    { email },
    { projection: { _id: 1 } }
  );
  if (!currentUser) return { error: "Unauthorized", status: 401 };

  const chat = await db.collection("chats").findOne(
    { _id: new ObjectId(chatId) },
    { projection: { _id: 1, companyId: 1, studentId: 1 } }
  );
  if (!chat) return { error: "Chat not found", status: 404 };

  const isParticipant =
    (chat.companyId as ObjectId).toString() === currentUser._id.toString() ||
    (chat.studentId as ObjectId).toString() === currentUser._id.toString();
  if (!isParticipant) return { error: "Forbidden", status: 403 };

  return { db, currentUser, chat };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ chatId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId } = await context.params;
  const authorized = await getAuthorizedChat(chatId, session.user.email);
  if ("error" in authorized) {
    return NextResponse.json({ error: authorized.error }, { status: authorized.status });
  }

  const messages = await authorized.db
    .collection("chatMessages")
    .find({ chatId: authorized.chat._id })
    .sort({ createdAt: 1 })
    .limit(200)
    .toArray();

  return NextResponse.json({
    messages: messages.map((message) => ({
      id: message._id.toString(),
      text: String(message.text ?? ""),
      senderId: (message.senderId as ObjectId).toString(),
      senderRole: String(message.senderRole ?? ""),
      createdAt: new Date(message.createdAt ?? Date.now()).toISOString(),
    })),
    currentUserId: authorized.currentUser._id.toString(),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ chatId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = messageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const { chatId } = await context.params;
  const authorized = await getAuthorizedChat(chatId, session.user.email);
  if ("error" in authorized) {
    return NextResponse.json({ error: authorized.error }, { status: authorized.status });
  }

  const senderRole =
    (authorized.chat.companyId as ObjectId).toString() ===
    authorized.currentUser._id.toString()
      ? "company"
      : "student";

  const now = new Date();
  await authorized.db.collection("chatMessages").insertOne({
    chatId: authorized.chat._id,
    senderId: authorized.currentUser._id,
    senderRole,
    text: parsed.data.text,
    createdAt: now,
  });

  await authorized.db.collection("chats").updateOne(
    { _id: authorized.chat._id },
    {
      $set: {
        updatedAt: now,
        lastMessageAt: now,
      },
    }
  );

  const recipientId =
    senderRole === "company"
      ? (authorized.chat.studentId as ObjectId)
      : (authorized.chat.companyId as ObjectId);

  await createNotification({
    userId: recipientId,
    type: "chat_message",
    title: "New message",
    body:
      senderRole === "company"
        ? "Company sent you a message."
        : "Applicant sent you a message.",
    link: "/chats",
  });

  return NextResponse.json({ ok: true });
}
