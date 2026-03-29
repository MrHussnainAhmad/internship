import { NextResponse } from "next/server";
import { getInternshipBySlug } from "@/lib/internships";

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
