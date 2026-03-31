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
  websiteUrl: z.string().trim().optional(),
  linkedinUrl: z.string().trim().optional(),
  twitterUrl: z.string().trim().optional(),
  instagramUrl: z.string().trim().optional(),
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
      websiteUrl: profile.websiteUrl ?? "",
      linkedinUrl: profile.linkedinUrl ?? "",
      twitterUrl: profile.twitterUrl ?? "",
      instagramUrl: profile.instagramUrl ?? "",
      verified: Boolean(profile.verified),
      verifiedAt: profile.verifiedAt
        ? new Date(profile.verifiedAt).toISOString()
        : "",
      domainEmail: profile.domainEmail ?? "",
      proofLinks: Array.isArray(profile.proofLinks)
        ? profile.proofLinks.map(String)
        : [],
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
        companyName: parsed.data.companyName,
        industry: parsed.data.industry,
        location: parsed.data.location,
        country: parsed.data.country,
        isRemote: parsed.data.isRemote,
        description: parsed.data.description,
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
