import { NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const schema = z.object({
  skills: z.array(z.string().trim().min(1)).max(10),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  education: z.string().trim().min(2).max(120),
  gpa: z.string().trim().max(20).optional().or(z.literal("")),
  languages: z.array(z.string().trim().min(1)).max(8),
  location: z.string().trim().min(2).max(60),
  country: z.string().trim().min(2).max(60).default("Pakistan"),
  preferredType: z.enum(["paid", "unpaid", "learn_and_earn"]),
  resumeUrl: z.string().url().optional().or(z.literal("")),
});

async function getUserObjectId() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ email: session.user.email }, { projection: { _id: 1, role: 1 } });
  if (!user) return null;
  return { userId: user._id as ObjectId, role: user.role as string | undefined };
}

export async function GET() {
  const user = await getUserObjectId();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const profile = await db.collection("studentProfiles").findOne({ userId: user.userId });
  if (!profile) return NextResponse.json({ profile: null });

  return NextResponse.json({
    profile: {
      skills: profile.skills ?? [],
      level: profile.level ?? "",
      education: profile.education ?? "",
      gpa: profile.gpa ?? "",
      languages: profile.languages ?? [],
      location: profile.location ?? "",
      country: profile.country ?? "Pakistan",
      preferredType: profile.preferredType ?? "paid",
      resumeUrl: profile.resumeUrl ?? "",
    },
  });
}

export async function PUT(request: Request) {
  const user = await getUserObjectId();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const db = await getDb();
  await db.collection("studentProfiles").updateOne(
    { userId: user.userId },
    {
      $set: {
        ...data,
        skills: data.skills.map((value) => value.toLowerCase()),
        languages: data.languages.map((value) => value.trim()),
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}
