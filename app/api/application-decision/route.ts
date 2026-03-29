import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

const schema = z.object({
  applicationId: z.string().min(1),
  decision: z.enum(["accepted", "rejected"]),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success || !ObjectId.isValid(parsed.data.applicationId)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const db = await getDb();
  const currentUser = await db.collection("users").findOne(
    { email: session.user.email },
    { projection: { _id: 1, role: 1 } }
  );
  if (!currentUser || currentUser.role !== "company") {
    return NextResponse.json(
      { error: "Only company accounts can manage applications." },
      { status: 403 }
    );
  }

  const application = await db.collection("applications").findOne(
    { _id: new ObjectId(parsed.data.applicationId) },
    { projection: { _id: 1, internshipId: 1, studentId: 1 } }
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

  return NextResponse.json({ ok: true, status: decision });
}
