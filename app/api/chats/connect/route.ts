import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { ensureIndexes } from "@/lib/indexes";

const schema = z.object({
  internshipId: z.string().min(1),
  studentId: z.string().min(1),
});

export async function POST(request: Request) {
  const currentUser = await getApiUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { internshipId, studentId } = parsed.data;
  if (!ObjectId.isValid(internshipId) || !ObjectId.isValid(studentId)) {
    return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
  }

  const db = await getDb();
  if (!currentUser || currentUser.role !== "company") {
    return NextResponse.json(
      { error: "Only company accounts can start applicant chats" },
      { status: 403 }
    );
  }

  const internshipObjectId = new ObjectId(internshipId);
  const studentObjectId = new ObjectId(studentId);

  const internship = await db.collection("internships").findOne(
    { _id: internshipObjectId },
    { projection: { _id: 1, companyId: 1, slug: 1, title: 1 } }
  );
  if (!internship) {
    return NextResponse.json({ error: "Internship not found" }, { status: 404 });
  }
  if ((internship.companyId as ObjectId).toString() !== currentUser._id.toString()) {
    return NextResponse.json(
      { error: "You can only chat for your own internship listings" },
      { status: 403 }
    );
  }

  const student = await db.collection("users").findOne(
    { _id: studentObjectId },
    { projection: { _id: 1, role: 1 } }
  );
  if (!student || student.role !== "student") {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  await ensureIndexes();

  const now = new Date();
  const result = await db.collection("chats").findOneAndUpdate(
    {
      internshipId: internshipObjectId,
      companyId: currentUser._id,
      studentId: studentObjectId,
    },
    {
      $set: {
        updatedAt: now,
        internshipSlug: String(internship.slug ?? ""),
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  return NextResponse.json({
    ok: true,
    chatId: result?._id?.toString(),
  });
}
