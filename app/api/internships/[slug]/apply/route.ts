import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureIndexes } from "@/lib/indexes";
import { createNotification } from "@/lib/notifications";

const REAPPLY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne(
    { email: session.user.email },
    { projection: { _id: 1, role: 1, name: 1 } }
  );
  if (!user || user.role !== "student") {
    return NextResponse.json(
      { error: "Only student accounts can apply" },
      { status: 403 }
    );
  }

  const { slug } = await context.params;
  const internship = await db.collection("internships").findOne(
    { slug },
    { projection: { _id: 1, title: 1, companyId: 1 } }
  );
  if (!internship) {
    return NextResponse.json({ error: "Internship not found" }, { status: 404 });
  }

  await ensureIndexes();

  const now = new Date();
  const existing = await db.collection("applications").findOne({
    internshipId: internship._id,
    studentId: user._id,
  });

  if (!existing) {
    await db.collection("applications").insertOne({
      internshipId: internship._id,
      studentId: user._id,
      status: "pending",
      seenByCompany: false,
      createdAt: now,
      updatedAt: now,
    });

    await createNotification({
      userId: internship.companyId as ObjectId,
      type: "application_applied",
      title: "New internship application",
      body: `${String(user.name ?? "A student")} applied to ${String(
        internship.title ?? "your internship"
      )}.`,
      link: `/internships/${slug}`,
    });

    return NextResponse.json({ ok: true, status: "pending" });
  }

  const status = String(existing.status ?? "pending");
  if (status === "pending") {
    return NextResponse.json(
      { error: "Application already submitted and pending review." },
      { status: 409 }
    );
  }
  if (status === "accepted") {
    return NextResponse.json(
      { error: "You are already accepted for this internship." },
      { status: 409 }
    );
  }

  const rejectedAt = existing.rejectedAt ? new Date(existing.rejectedAt) : null;
  if (rejectedAt) {
    const elapsed = now.getTime() - rejectedAt.getTime();
    if (elapsed < REAPPLY_COOLDOWN_MS) {
      const retryAfter = new Date(rejectedAt.getTime() + REAPPLY_COOLDOWN_MS);
      return NextResponse.json(
        {
          error: "You can reapply 24 hours after rejection.",
          retryAfter: retryAfter.toISOString(),
        },
        { status: 429 }
      );
    }
  }

  await db.collection("applications").updateOne(
    { _id: existing._id },
    {
      $set: {
        status: "pending",
        seenByCompany: false,
        reappliedAt: now,
        updatedAt: now,
      },
      $unset: {
        rejectedAt: "",
        acceptedAt: "",
        decidedAt: "",
      },
    }
  );

  await createNotification({
    userId: internship.companyId as ObjectId,
    type: "application_reapplied",
    title: "Application re-submitted",
    body: `${String(user.name ?? "A student")} re-applied to ${String(
      internship.title ?? "your internship"
    )}.`,
    link: `/internships/${slug}`,
  });

  return NextResponse.json({ ok: true, status: "pending", reapplied: true });
}
