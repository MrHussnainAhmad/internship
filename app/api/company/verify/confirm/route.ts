import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/api-auth";
import { getDb } from "@/lib/db";

const schema = z.object({
  otp: z.string().trim().regex(/^\d{4}$/),
});

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user || user.role !== "company") {
    return NextResponse.json({ error: "Only company accounts can verify." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid OTP format." }, { status: 400 });
  }

  const db = await getDb();
  const verification = await db.collection("companyVerifications").findOne({ userId: user._id });
  if (!verification) {
    return NextResponse.json({ error: "No verification request found. Start verification first." }, { status: 400 });
  }

  if (verification.verified) {
    return NextResponse.json({ ok: true, message: "Already verified." });
  }

  if (!verification.otpExpiresAt || new Date(verification.otpExpiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: "OTP expired. Request a new OTP." }, { status: 400 });
  }

  if (String(verification.otpCode ?? "") !== parsed.data.otp) {
    return NextResponse.json({ error: "Invalid OTP." }, { status: 400 });
  }

  await db.collection("companyProfiles").updateOne(
    { userId: user._id },
    {
      $set: {
        verified: true,
        verifiedAt: new Date(),
        domainEmail: String(verification.domainEmail ?? ""),
        websiteUrl: String(verification.websiteUrl ?? ""),
        linkedinUrl: String(verification.linkedinUrl ?? ""),
        twitterUrl: String(verification.twitterUrl ?? ""),
        instagramUrl: String(verification.instagramUrl ?? ""),
        proofLinks: Array.isArray(verification.proofLinks)
          ? verification.proofLinks.map(String)
          : [],
        updatedAt: new Date(),
      },
    }
  );

  await db.collection("users").updateOne(
    { _id: user._id },
    {
      $set: {
        companyVerified: true,
        updatedAt: new Date(),
      },
    }
  );

  await db.collection("companyVerifications").updateOne(
    { _id: verification._id },
    {
      $set: {
        verified: true,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      },
      $unset: {
        otpCode: "",
      },
    }
  );

  return NextResponse.json({ ok: true, message: "Company verified successfully." });
}
