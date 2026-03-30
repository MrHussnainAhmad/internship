import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/api-auth";
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
  resumeUrl: z.string().trim().url().min(1),
});

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const profile = await db.collection("studentProfiles").findOne({ userId: user._id });
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
  const user = await getApiUser(request);
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
    { userId: user._id },
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
