import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import {
  generateOtp,
  isValidDomainEmailForWebsite,
  normalizeWebsiteDomain,
  sendVerificationOtpEmail,
} from "@/lib/company-verify";
import { ensureIndexes } from "@/lib/indexes";

const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("https://"), {
    message: "Only https:// links are allowed.",
  });

const schema = z.object({
  websiteUrl: httpsUrl,
  linkedinUrl: httpsUrl,
  twitterUrl: httpsUrl,
  instagramUrl: httpsUrl,
  domainEmail: z.string().trim().email(),
  proofLinks: z.array(httpsUrl).min(1, "Add at least one proof link."),
});

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user || user.role !== "company") {
    return NextResponse.json({ error: "Only company accounts can request verification." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const websiteDomain = normalizeWebsiteDomain(input.websiteUrl);
  if (!websiteDomain) {
    return NextResponse.json({ error: "Invalid website URL." }, { status: 400 });
  }

  const domainCheck = isValidDomainEmailForWebsite(input.domainEmail, websiteDomain);
  if (!domainCheck.ok) {
    return NextResponse.json(
      {
        error: domainCheck.reason,
        issues: {
          fieldErrors: {
            domainEmail: [domainCheck.reason],
          },
        },
      },
      { status: 400 }
    );
  }

  const db = await getDb();
  await ensureIndexes();
  const companyProfile = await db.collection("companyProfiles").findOne({ userId: user._id });
  if (!companyProfile) {
    return NextResponse.json({ error: "Complete company profile first." }, { status: 400 });
  }

  const otp = generateOtp();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const companyName = String(companyProfile.companyName ?? "Company");

  const mailResult = await sendVerificationOtpEmail({
    to: input.domainEmail,
    otp,
    companyName,
  });

  if (!mailResult.ok) {
    return NextResponse.json(
      {
        error: mailResult.error,
      },
      { status: 500 }
    );
  }

  await db.collection("companyVerifications").updateOne(
    { userId: user._id },
    {
      $set: {
        userId: user._id,
        companyName,
        websiteUrl: input.websiteUrl,
        linkedinUrl: input.linkedinUrl,
        twitterUrl: input.twitterUrl,
        instagramUrl: input.instagramUrl,
        domainEmail: input.domainEmail.toLowerCase(),
        proofLinks: input.proofLinks,
        otpCode: otp,
        otpExpiresAt,
        verified: false,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  return NextResponse.json({
    ok: true,
    message: "OTP sent to domain email.",
  });
}
