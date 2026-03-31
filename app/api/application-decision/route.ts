import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { ensureIndexes } from "@/lib/indexes";
import { createNotification } from "@/lib/notifications";

const schema = z.object({
  applicationId: z.string().min(1),
  decision: z.enum(["accepted", "rejected"]),
});

export async function POST(request: Request) {
  const currentUser = await getApiUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success || !ObjectId.isValid(parsed.data.applicationId)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const db = await getDb();
  if (!currentUser || currentUser.role !== "company") {
    return NextResponse.json(
      { error: "Only company accounts can manage applications." },
      { status: 403 }
    );
  }

  const application = await db.collection("applications").findOne(
    { _id: new ObjectId(parsed.data.applicationId) },
    { projection: { _id: 1, internshipId: 1, studentId: 1, status: 1 } }
  );
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const internship = await db.collection("internships").findOne(
    { _id: application.internshipId },
    { projection: { _id: 1, companyId: 1, title: 1, slug: 1 } }
  );
  if (!internship) {
    return NextResponse.json({ error: "Internship not found" }, { status: 404 });
  }
  if ((internship.companyId as ObjectId).toString() !== currentUser._id.toString()) {
    return NextResponse.json(
      { error: "You can only manage applications for your own internships." },
      { status: 403 }
    );
  }

  const now = new Date();
  const decision = parsed.data.decision;
  const previousStatus = String((application as { status?: unknown }).status ?? "pending");

  await db.collection("applications").updateOne(
    { _id: application._id },
    {
      $set: {
        status: decision,
        decidedAt: now,
        updatedAt: now,
        acceptedAt: decision === "accepted" ? now : null,
        rejectedAt: decision === "rejected" ? now : null,
      },
    }
  );

  await createNotification({
    userId: application.studentId as ObjectId,
    type: `application_${decision}`,
    title: decision === "accepted" ? "Application accepted" : "Application rejected",
    body:
      decision === "accepted"
        ? `You were accepted for ${String(internship.title ?? "an internship")}.`
        : `Your application for ${String(
            internship.title ?? "an internship"
          )} was rejected. You can reapply after 24 hours.`,
    link: `/internships/${String(internship.slug ?? "")}`,
  });

  if (decision === "accepted" && previousStatus !== "accepted") {
    await ensureIndexes();

    const companyProfile = await db.collection("companyProfiles").findOne(
      { userId: currentUser._id },
      { projection: { companyName: 1 } }
    );
    const companyName =
      String(companyProfile?.companyName ?? "").trim() ||
      String(currentUser.name ?? "").trim() ||
      "the hiring team";
    const internshipTitle = String(internship.title ?? "this internship");

    const chat = await db.collection("chats").findOneAndUpdate(
      {
        internshipId: internship._id,
        companyId: currentUser._id,
        studentId: application.studentId as ObjectId,
      },
      {
        $set: {
          updatedAt: now,
          lastMessageAt: now,
          internshipSlug: String(internship.slug ?? ""),
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    if (chat?._id) {
      const autoMessage = [
        `Hey, congrats! You have been selected by ${companyName}.`,
        `You applied for: ${internshipTitle}.`,
        "Welcome aboard. Please reply here so we can start the next steps.",
        "",
        "-- This message was sent automatically by InternHub --",
      ].join("\n");

      await db.collection("chatMessages").insertOne({
        chatId: chat._id,
        senderId: currentUser._id,
        senderRole: "company",
        text: autoMessage,
        createdAt: now,
      });

      await createNotification({
        userId: application.studentId as ObjectId,
        type: "chat_message",
        title: "New message from company",
        body: `${companyName} sent you a message after accepting your application.`,
        link: "/chats",
      });
    }
  }

  return NextResponse.json({ ok: true, status: decision });
}

