import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createInternshipSlug } from "@/lib/slug";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatInternshipTitle } from "@/lib/format";
import { ensureIndexes } from "@/lib/indexes";
import { queryInternships } from "@/lib/internships";

const internshipSchema = z.object({
  title: z.string().trim().min(4).max(100),
  skillsRequired: z.array(z.string().trim().min(1)).min(1).max(10),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  type: z.enum(["paid", "unpaid", "learn_and_earn"]),
  isPaid: z.boolean(),
  location: z.string().trim().min(2).max(60),
  country: z.string().trim().min(2).max(60).default("Pakistan"),
  isRemote: z.boolean(),
  duration: z.string().trim().min(1).max(40),
  resumeRequired: z.boolean(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().trim().min(1).max(300),
});

async function getCompanyUser() {
  const session = await auth();
  if (!session?.user?.email) return null;

  const db = await getDb();
  const user = await db.collection("users").findOne(
    { email: session.user.email },
    { projection: { _id: 1, role: 1 } }
  );
  if (!user || user.role !== "company") return null;
  return user;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const result = await queryInternships({
    q: searchParams.get("q") ?? undefined,
    location: searchParams.get("location") ?? undefined,
    level: searchParams.get("level") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    paid: searchParams.get("paid") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const companyUser = await getCompanyUser();
  if (!companyUser) {
    return NextResponse.json(
      { error: "Only company accounts can post internships" },
      { status: 403 }
    );
  }

  const parsed = internshipSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await ensureIndexes();

  const db = await getDb();
  const internships = db.collection("internships");
  const data = parsed.data;
  const formattedTitle = formatInternshipTitle(data.title);
  const baseSlug = createInternshipSlug(formattedTitle, data.location);
  let slug = baseSlug;
  let i = 1;

  while (await internships.findOne({ slug }, { projection: { _id: 1 } })) {
    i += 1;
    slug = `${baseSlug}-${i}`;
  }

  const doc = {
    companyId: companyUser._id,
    slug,
    title: formattedTitle,
    skillsRequired: data.skillsRequired.map((value) => value.toLowerCase()),
    level: data.level,
    type: data.type,
    isPaid: data.isPaid,
    location: data.location,
    country: data.country,
    isRemote: data.isRemote,
    duration: data.duration,
    resumeRequired: data.resumeRequired,
    imageUrl: data.imageUrl || undefined,
    description: data.description,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const { insertedId } = await internships.insertOne(doc);
  return NextResponse.json({
    ok: true,
    internship: {
      id: insertedId.toString(),
      slug,
    },
  });
}
