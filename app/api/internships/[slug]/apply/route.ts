import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { ensureIndexes } from "@/lib/indexes";
import { createNotification } from "@/lib/notifications";

const REAPPLY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  if (!user || user.role !== "student") {
    return NextResponse.json(
      { error: "Only student accounts can apply" },
      { status: 403 }
    );
  }

  const { slug } = await context.params;
  const internship = await db.collection("internships").findOne(
    { slug },
    { projection: { _id: 1, title: 1, companyId: 1, resumeRequired: 1 } }
  );
  if (!internship) {
    return NextResponse.json({ error: "Internship not found" }, { status: 404 });
  }

  const studentProfile = await db
    .collection("studentProfiles")
    .findOne({ userId: user._id }, { projection: { resumeUrl: 1 } });
  const resumeUrl =
    typeof studentProfile?.resumeUrl === "string" && studentProfile.resumeUrl.trim()
      ? studentProfile.resumeUrl.trim()
      : "";

  if (internship.resumeRequired === true && !resumeUrl) {
    return NextResponse.json(
      { error: "Resume required. Upload resume in your profile before applying." },
      { status: 400 }
    );
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
      resumeUrl,
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
        resumeUrl,
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
