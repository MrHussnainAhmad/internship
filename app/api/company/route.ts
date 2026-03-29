import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/api-auth";
import { getDb } from "@/lib/db";

const schema = z.object({
  companyName: z.string().trim().min(2).max(80),
  industry: z.string().trim().min(2).max(80),
  location: z.string().trim().min(2).max(60),
  country: z.string().trim().min(2).max(60).default("Pakistan"),
  isRemote: z.boolean(),
  description: z.string().trim().min(10).max(200),
});

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const profile = await db
    .collection("companyProfiles")
    .findOne({ userId: user._id });
  if (!profile) return NextResponse.json({ profile: null });

  return NextResponse.json({
    profile: {
      companyName: profile.companyName ?? "",
      industry: profile.industry ?? "",
      location: profile.location ?? "",
      country: profile.country ?? "Pakistan",
      isRemote: Boolean(profile.isRemote),
      description: profile.description ?? "",
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

  const db = await getDb();
  await db.collection("companyProfiles").updateOne(
    { userId: user._id },
    {
      $set: {
        ...parsed.data,
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
