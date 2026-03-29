import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const db = await getDb();

  const internships = await db
    .collection("internships")
    .find({}, { projection: { slug: 1, updatedAt: 1 } })
    .limit(5000)
    .toArray();

  const internshipRoutes = internships.map((item) => ({
    url: `${base}/internships/${String(item.slug ?? "")}`,
    lastModified: item.updatedAt ? new Date(item.updatedAt) : new Date(),
  }));

  return [
    { url: `${base}/`, lastModified: new Date() },
    { url: `${base}/internships`, lastModified: new Date() },
    ...internshipRoutes,
  ];
}
