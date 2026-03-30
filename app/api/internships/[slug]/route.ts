import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { getInternshipBySlug } from "@/lib/internships";
import { formatInternshipTitle } from "@/lib/format";

const internshipUpdateSchema = z.object({
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const internship = await getInternshipBySlug(slug);
  if (!internship) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ internship });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const currentUser = await getApiUser(request);
  if (!currentUser || currentUser.role !== "company") {
    return NextResponse.json(
      { error: "Only company accounts can edit internships" },
      { status: 403 }
    );
  }

  const parsed = internshipUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { slug } = await context.params;
  const db = await getDb();
  const internships = db.collection("internships");

  const existing = await internships.findOne(
    { slug },
    { projection: { _id: 1, companyId: 1 } }
  );
  if (!existing) {
    return NextResponse.json({ error: "Internship not found" }, { status: 404 });
  }

  if (String(existing.companyId) !== currentUser._id.toString()) {
    return NextResponse.json(
      { error: "You can only edit your own internship listings" },
      { status: 403 }
    );
  }

  const data = parsed.data;
  const updateSet = {
    title: formatInternshipTitle(data.title),
    skillsRequired: data.skillsRequired.map((value) => value.toLowerCase()),
    level: data.level,
    type: data.type,
    isPaid: data.isPaid,
    location: data.location,
    country: data.country,
    isRemote: data.isRemote,
    duration: data.duration,
    resumeRequired: data.resumeRequired,
    description: data.description,
    updatedAt: new Date(),
  };

  const updateOps: {
    $set: typeof updateSet & { imageUrl?: string };
    $unset?: { imageUrl: "" };
  } = { $set: updateSet };

  if (data.imageUrl) {
    updateOps.$set.imageUrl = data.imageUrl;
  } else {
    updateOps.$unset = { imageUrl: "" };
  }

  await internships.updateOne({ _id: existing._id }, updateOps);

  return NextResponse.json({ ok: true, slug });
}
