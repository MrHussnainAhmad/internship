import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { formatInternshipTitle } from "@/lib/format";
import { ensureIndexes } from "@/lib/indexes";
import { parseSearchKeywords } from "@/lib/search";

type InternshipFilters = {
  q?: string;
  location?: string;
  level?: string;
  type?: string;
  paid?: string;
  page?: string;
  limit?: string;
  excludeAppliedForStudentId?: string;
};

type InternshipListItem = {
  _id: string;
  slug: string;
  title: string;
  skillsRequired: string[];
  level: string;
  type: string;
  isPaid: boolean;
  location: string;
  country: string;
  isRemote: boolean;
  duration: string;
  imageUrl?: string;
  description: string;
  companyName: string;
  companyVerified?: boolean;
  createdAt: string;
};

export type InternshipListResponse = {
  items: InternshipListItem[];
  total: number;
  page: number;
  limit: number;
};

function normalizeBoolean(input?: string) {
  if (!input) return undefined;
  if (input === "true") return true;
  if (input === "false") return false;
  return undefined;
}

function asRegex(value: string) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function buildTextSearchQuery(rawQuery: string, skillTerms: string[]) {
  const tokens = rawQuery
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const expanded = new Set<string>([...tokens, ...skillTerms]);
  for (const token of [...expanded]) {
    if (token === "dev") {
      expanded.add("development");
      expanded.add("developer");
    }
    if (token === "js") expanded.add("javascript");
    if (token === "ts") expanded.add("typescript");
  }

  return [...expanded].join(" ").trim();
}

export async function queryInternships(
  filters: InternshipFilters
): Promise<InternshipListResponse> {
  await ensureIndexes();

  const db = await getDb();
  const internships = db.collection("internships");
  const companies = db.collection("companyProfiles");

  const page = Math.max(1, Number(filters.page ?? "1") || 1);
  const limit = Math.min(20, Math.max(1, Number(filters.limit ?? "10") || 10));

  const rawQuery = filters.q?.trim() ?? "";
  const parsed = parseSearchKeywords(rawQuery);
  const locationInput = filters.location?.trim().toLowerCase();
  const locationTerms = [
    ...(locationInput ? [locationInput] : []),
    ...parsed.locationTerms,
  ];

  const andClauses: Record<string, unknown>[] = [];

  const textSearch = rawQuery
    ? buildTextSearchQuery(rawQuery, parsed.skillTerms)
    : "";
  const useTextSearch = Boolean(textSearch);

  if (useTextSearch) {
    andClauses.push({ $text: { $search: textSearch } });
  } else if (parsed.skillTerms.length > 0) {
    andClauses.push({ skillsRequired: { $in: parsed.skillTerms.map(asRegex) } });
  }

  const level = filters.level ?? parsed.level;
  if (level) andClauses.push({ level });

  const type = filters.type ?? parsed.type;
  if (type) andClauses.push({ type });

  const paidFilter = normalizeBoolean(filters.paid);
  if (typeof paidFilter === "boolean") andClauses.push({ isPaid: paidFilter });

  if (locationTerms.length > 0) {
    const locationQuery = { $in: locationTerms.map(asRegex) };
    andClauses.push({
      $or: [{ location: locationQuery }, { country: locationQuery }, { isRemote: true }],
    });
  }

  if (filters.excludeAppliedForStudentId && ObjectId.isValid(filters.excludeAppliedForStudentId)) {
    const appliedInternshipIds = await db
      .collection("applications")
      .find(
        { studentId: new ObjectId(filters.excludeAppliedForStudentId) },
        { projection: { internshipId: 1 } }
      )
      .toArray()
      .then((rows) =>
        rows
          .map((row) => row.internshipId)
          .filter((id): id is ObjectId => id instanceof ObjectId)
      );

    if (appliedInternshipIds.length > 0) {
      andClauses.push({ _id: { $nin: appliedInternshipIds } });
    }
  }

  const where = andClauses.length > 0 ? { $and: andClauses } : {};

  const total = await internships.countDocuments(where);

  const projection: Record<string, unknown> = {
    title: 1,
    slug: 1,
    skillsRequired: 1,
    level: 1,
    type: 1,
    isPaid: 1,
    location: 1,
    country: 1,
    isRemote: 1,
    duration: 1,
    imageUrl: 1,
    description: 1,
    companyId: 1,
    createdAt: 1,
  };

  if (useTextSearch) {
    projection.score = { $meta: "textScore" };
  }

  const baseCursor = internships
    .find(where)
    .project(projection)
    .skip((page - 1) * limit)
    .limit(limit);

  const rows = await (useTextSearch
    ? baseCursor
        .sort({ score: { $meta: "textScore" }, createdAt: -1 } as never)
        .toArray()
    : baseCursor.sort({ createdAt: -1 }).toArray());

  const companyIds = rows
    .map((row) => row.companyId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const companyRows = await companies
    .find({ userId: { $in: companyIds } })
    .project({ userId: 1, companyName: 1, verified: 1 })
    .toArray();
  const companyMap = new Map(companyRows.map((row) => [row.userId.toString(), row]));

  const items = rows.map((row) => ({
    _id: row._id.toString(),
    slug: String(row.slug ?? ""),
    title: formatInternshipTitle(String(row.title ?? "")),
    skillsRequired: Array.isArray(row.skillsRequired)
      ? row.skillsRequired.map(String)
      : [],
    level: String(row.level ?? ""),
    type: String(row.type ?? ""),
    isPaid: Boolean(row.isPaid),
    location: String(row.location ?? ""),
    country: String(row.country ?? ""),
    isRemote: Boolean(row.isRemote),
    duration: String(row.duration ?? ""),
    imageUrl: row.imageUrl ? String(row.imageUrl) : undefined,
    description: String(row.description ?? ""),
    companyName:
      String(companyMap.get((row.companyId as ObjectId).toString())?.companyName ?? "Company"),
    companyVerified: Boolean(
      companyMap.get((row.companyId as ObjectId).toString())?.verified
    ),
    createdAt: new Date(row.createdAt ?? Date.now()).toISOString(),
  }));

  return {
    items,
    total,
    page,
    limit,
  };
}

export async function getInternshipBySlug(slug: string) {
  const db = await getDb();
  const internship = await db.collection("internships").findOne({ slug });
  if (!internship) return null;

  const company = await db.collection("companyProfiles").findOne(
    { userId: internship.companyId },
    {
      projection: {
        companyName: 1,
        industry: 1,
        location: 1,
        country: 1,
        isRemote: 1,
        description: 1,
        verified: 1,
      },
    }
  );
  const companyUser = await db.collection("users").findOne(
    { _id: internship.companyId },
    { projection: { username: 1, name: 1 } }
  );

  return {
    _id: internship._id.toString(),
    slug: String(internship.slug),
    title: formatInternshipTitle(String(internship.title)),
    skillsRequired: Array.isArray(internship.skillsRequired)
      ? internship.skillsRequired.map(String)
      : [],
    level: String(internship.level),
    type: String(internship.type),
    isPaid: Boolean(internship.isPaid),
    location: String(internship.location),
    country: String(internship.country),
    isRemote: Boolean(internship.isRemote),
    duration: String(internship.duration),
    resumeRequired: Boolean(internship.resumeRequired),
    imageUrl: internship.imageUrl ? String(internship.imageUrl) : undefined,
    description: String(internship.description),
    companyId: (internship.companyId as ObjectId).toString(),
    company: company
      ? {
          companyName: String(company.companyName ?? ""),
          username: String(companyUser?.username ?? ""),
          industry: String(company.industry ?? ""),
          location: String(company.location ?? ""),
          country: String(company.country ?? ""),
          isRemote: Boolean(company.isRemote),
          description: String(company.description ?? ""),
          verified: Boolean(company.verified),
        }
      : null,
    createdAt: new Date(internship.createdAt ?? Date.now()).toISOString(),
  };
}

export async function getRelatedInternships(args: {
  internshipId: string;
  skillsRequired: string[];
  location: string;
  limit?: number;
  excludeInternshipIds?: string[];
}) {
  const db = await getDb();
  const limit = Math.min(8, Math.max(1, args.limit ?? 4));

  const where: Record<string, unknown> = {
    _id: { $ne: new ObjectId(args.internshipId) },
  };
  const excludeIds = (args.excludeInternshipIds ?? [])
    .filter((value) => ObjectId.isValid(value))
    .map((value) => new ObjectId(value));
  if (excludeIds.length > 0) {
    where._id = { $nin: [new ObjectId(args.internshipId), ...excludeIds] };
  }
  const conditions: Record<string, unknown>[] = [];

  if (args.skillsRequired.length > 0) {
    conditions.push({ skillsRequired: { $in: args.skillsRequired.map((s) => s.toLowerCase()) } });
  }
  if (args.location.trim()) {
    conditions.push({ location: new RegExp(args.location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") });
  }
  if (conditions.length > 0) {
    where.$or = conditions;
  }

  const rows = await db
    .collection("internships")
    .find(where)
    .project({
      _id: 1,
      slug: 1,
      title: 1,
      skillsRequired: 1,
      level: 1,
      type: 1,
      location: 1,
      country: 1,
      isRemote: 1,
      companyId: 1,
      createdAt: 1,
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  const companyIds = rows
    .map((row) => row.companyId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const companyRows = companyIds.length
    ? await db
        .collection("companyProfiles")
        .find({ userId: { $in: companyIds } })
        .project({ userId: 1, companyName: 1, verified: 1 })
        .toArray()
    : [];
  const companyMap = new Map(companyRows.map((row) => [row.userId.toString(), row]));

  return rows.map((row) => ({
    id: row._id.toString(),
    slug: String(row.slug ?? ""),
    title: formatInternshipTitle(String(row.title ?? "")),
    companyName:
      String(companyMap.get(String(row.companyId ?? ""))?.companyName ?? "Company"),
    companyVerified: Boolean(companyMap.get(String(row.companyId ?? ""))?.verified),
    skillsRequired: Array.isArray(row.skillsRequired) ? row.skillsRequired.map(String) : [],
    level: String(row.level ?? ""),
    type: String(row.type ?? ""),
    location: String(row.location ?? ""),
    country: String(row.country ?? ""),
    isRemote: Boolean(row.isRemote),
  }));
}
