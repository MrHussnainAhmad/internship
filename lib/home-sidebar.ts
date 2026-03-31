import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

type OpportunityItem = {
  id: string;
  slug: string;
  title: string;
  companyName: string;
  companyVerified?: boolean;
  location: string;
  country: string;
  isRemote: boolean;
  matchPercent: number;
  matchedSkills: string[];
  createdAt: string;
};

type SimilarUser = {
  id: string;
  name: string;
  username: string;
  role: string;
  image: string;
  headline: string;
  sharedSkills: string[];
};

type CurrentProfileSidebar = {
  id: string;
  name: string;
  username: string;
  role: string;
  image: string;
  location: string;
  applicationProgress: {
    submitted: number;
    pending: number;
    accepted: number;
    rejected: number;
    posted: number;
    totalApplicants: number;
  };
  profileStrength: {
    score: number;
    missing: string[];
  };
};

const MAX_OPPORTUNITIES = 3;
const MAX_PEOPLE_LIKE_YOU = 3;

function normalizeSkills(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  for (const value of values) {
    const skill = String(value ?? "").trim().toLowerCase();
    if (!skill) continue;
    seen.add(skill);
  }
  return [...seen];
}

function calculateMatch(requiredSkills: string[], viewerSkills: string[]) {
  if (requiredSkills.length === 0 || viewerSkills.length === 0) {
    return { matchedSkills: [] as string[], matchPercent: 0 };
  }
  const viewerSet = new Set(viewerSkills.map((value) => value.toLowerCase()));
  const matchedSkills = requiredSkills.filter((skill) => viewerSet.has(skill.toLowerCase()));
  const matchPercent = Math.round((matchedSkills.length / requiredSkills.length) * 100);
  return { matchedSkills, matchPercent };
}

function profileStrengthForStudent(user: Record<string, unknown>, profile: Record<string, unknown>) {
  const checks = [
    { label: "Add your name", ok: Boolean(String(user.name ?? "").trim()) },
    { label: "Pick a username", ok: Boolean(String(user.username ?? "").trim()) },
    { label: "Write a short bio", ok: Boolean(String(user.bio ?? "").trim()) },
    { label: "Add your skills", ok: normalizeSkills(profile.skills).length > 0 },
    { label: "Add your education", ok: Boolean(String(profile.education ?? "").trim()) },
    { label: "Set your location", ok: Boolean(String(profile.location ?? "").trim()) },
    { label: "Add languages", ok: Array.isArray(profile.languages) && profile.languages.length > 0 },
    { label: "Upload your resume", ok: Boolean(String(profile.resumeUrl ?? "").trim()) },
  ];

  const complete = checks.filter((item) => item.ok).length;
  const score = Math.round((complete / checks.length) * 100);
  const missing = checks.filter((item) => !item.ok).map((item) => item.label).slice(0, 4);
  return { score, missing };
}

function profileStrengthForCompany(user: Record<string, unknown>, profile: Record<string, unknown>) {
  const checks = [
    { label: "Add your name", ok: Boolean(String(user.name ?? "").trim()) },
    { label: "Pick a username", ok: Boolean(String(user.username ?? "").trim()) },
    { label: "Write a short bio", ok: Boolean(String(user.bio ?? "").trim()) },
    { label: "Add company name", ok: Boolean(String(profile.companyName ?? "").trim()) },
    { label: "Set your industry", ok: Boolean(String(profile.industry ?? "").trim()) },
    { label: "Set location", ok: Boolean(String(profile.location ?? "").trim()) },
    { label: "Write company description", ok: Boolean(String(profile.description ?? "").trim()) },
  ];

  const complete = checks.filter((item) => item.ok).length;
  const score = Math.round((complete / checks.length) * 100);
  const missing = checks.filter((item) => !item.ok).map((item) => item.label).slice(0, 4);
  return { score, missing };
}

export async function getHomeSidebarData(args: {
  viewerId: string;
  viewerRole: string;
}): Promise<{
  currentProfile: CurrentProfileSidebar;
  opportunities: OpportunityItem[];
  peopleLikeYou: SimilarUser[];
}> {
  const db = await getDb();
  const viewerObjectId = new ObjectId(args.viewerId);

  const [user, studentProfile, companyProfile, followingRows] = await Promise.all([
    db
      .collection("users")
      .findOne(
        { _id: viewerObjectId },
        { projection: { _id: 1, name: 1, username: 1, role: 1, image: 1, bio: 1 } }
      ),
    db.collection("studentProfiles").findOne({ userId: viewerObjectId }),
    db.collection("companyProfiles").findOne({ userId: viewerObjectId }),
    db
      .collection("connections")
      .find({ fromUserId: viewerObjectId })
      .project({ toUserId: 1 })
      .toArray(),
  ]);

  const followingIds = followingRows
    .map((item) => item.toUserId)
    .filter((id): id is ObjectId => id instanceof ObjectId);

  const viewerSkills =
    args.viewerRole === "student"
      ? normalizeSkills(studentProfile?.skills)
      : [];
  const appliedInternshipIds =
    args.viewerRole === "student"
      ? await db
          .collection("applications")
          .find(
            { studentId: viewerObjectId },
            { projection: { internshipId: 1 } }
          )
          .toArray()
          .then((rows) =>
            rows
              .map((row) => row.internshipId)
              .filter((id): id is ObjectId => id instanceof ObjectId)
          )
      : [];

  const opportunityRows = viewerSkills.length
    ? await db
        .collection("internships")
        .find({
          skillsRequired: { $in: viewerSkills },
          ...(appliedInternshipIds.length > 0
            ? { _id: { $nin: appliedInternshipIds } }
            : {}),
        })
        .project({
          _id: 1,
          slug: 1,
          title: 1,
          companyId: 1,
          location: 1,
          country: 1,
          isRemote: 1,
          skillsRequired: 1,
          createdAt: 1,
        })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray()
    : [];

  const opportunityCompanyIds = opportunityRows
    .map((row) => row.companyId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const opportunityCompanies = opportunityCompanyIds.length
    ? await db
        .collection("companyProfiles")
        .find({ userId: { $in: opportunityCompanyIds } })
        .project({ userId: 1, companyName: 1, verified: 1 })
        .toArray()
    : [];
  const opportunityCompanyMap = new Map(
    opportunityCompanies.map((item) => [item.userId.toString(), item])
  );

  const opportunities: OpportunityItem[] = opportunityRows
    .map((row) => {
      const requiredSkills = normalizeSkills(row.skillsRequired);
      const { matchedSkills, matchPercent } = calculateMatch(requiredSkills, viewerSkills);
      if (matchedSkills.length === 0) return null;
      return {
        id: row._id.toString(),
        slug: String(row.slug ?? ""),
        title: String(row.title ?? ""),
        companyName:
          String(opportunityCompanyMap.get(String(row.companyId ?? ""))?.companyName ?? "Company"),
        companyVerified: Boolean(opportunityCompanyMap.get(String(row.companyId ?? ""))?.verified),
        location: String(row.location ?? ""),
        country: String(row.country ?? ""),
        isRemote: Boolean(row.isRemote),
        matchPercent,
        matchedSkills,
        createdAt: new Date(row.createdAt ?? Date.now()).toISOString(),
      };
    })
    .filter((item): item is OpportunityItem => item !== null)
    .filter((item) => item.matchPercent >= 60)
    .sort((a, b) => (b.matchPercent !== a.matchPercent ? b.matchPercent - a.matchPercent : a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, MAX_OPPORTUNITIES);

  const excludeIds = [viewerObjectId, ...followingIds];
  const studentCandidates = viewerSkills.length
    ? await db
        .collection("studentProfiles")
        .find({
          userId: { $nin: excludeIds },
          skills: { $in: viewerSkills },
        })
        .project({ userId: 1, skills: 1, education: 1, location: 1, country: 1 })
        .limit(40)
        .toArray()
    : [];

  const studentCandidateIds = studentCandidates
    .map((item) => item.userId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const peopleUsers = studentCandidateIds.length
    ? await db
        .collection("users")
        .find({ _id: { $in: studentCandidateIds }, username: { $exists: true, $ne: "" } })
        .project({ _id: 1, name: 1, username: 1, image: 1, role: 1 })
        .toArray()
    : [];

  const userMap = new Map(peopleUsers.map((item) => [item._id.toString(), item]));

  const peopleLikeYou: SimilarUser[] = studentCandidates
    .map((profile) => {
      const candidateUser = userMap.get((profile.userId as ObjectId).toString());
      if (!candidateUser) return null;
      const candidateSkills = normalizeSkills(profile.skills);
      const { matchedSkills } = calculateMatch(candidateSkills, viewerSkills);
      if (matchedSkills.length === 0) return null;
      return {
        id: candidateUser._id.toString(),
        name: String(candidateUser.name ?? ""),
        username: String(candidateUser.username ?? ""),
        role: String(candidateUser.role ?? "student"),
        image: String(candidateUser.image ?? ""),
        headline: String(profile.education ?? profile.location ?? ""),
        sharedSkills: matchedSkills.slice(0, 3),
      };
    })
    .filter((item): item is SimilarUser => item !== null)
    .sort((a, b) => b.sharedSkills.length - a.sharedSkills.length)
    .slice(0, MAX_PEOPLE_LIKE_YOU);

  const applicationProgress =
    args.viewerRole === "student"
      ? await (async () => {
          const rows = await db
            .collection("applications")
            .find({ studentId: viewerObjectId })
            .project({ status: 1 })
            .toArray();

          let pending = 0;
          let accepted = 0;
          let rejected = 0;
          for (const row of rows) {
            const status = String(row.status ?? "pending");
            if (status === "accepted") accepted += 1;
            else if (status === "rejected") rejected += 1;
            else pending += 1;
          }

          return {
            submitted: rows.length,
            pending,
            accepted,
            rejected,
            posted: 0,
            totalApplicants: 0,
          };
        })()
      : await (async () => {
          const postedInternships = await db
            .collection("internships")
            .find({ companyId: viewerObjectId })
            .project({ _id: 1 })
            .toArray();
          const internshipIds = postedInternships
            .map((item) => item._id)
            .filter((id): id is ObjectId => id instanceof ObjectId);

          const applicationRows = internshipIds.length
            ? await db
                .collection("applications")
                .find({ internshipId: { $in: internshipIds } })
                .project({ status: 1 })
                .toArray()
            : [];

          let pending = 0;
          let accepted = 0;
          let rejected = 0;
          for (const row of applicationRows) {
            const status = String(row.status ?? "pending");
            if (status === "accepted") accepted += 1;
            else if (status === "rejected") rejected += 1;
            else pending += 1;
          }

          return {
            submitted: 0,
            pending,
            accepted,
            rejected,
            posted: postedInternships.length,
            totalApplicants: applicationRows.length,
          };
        })();

  const profileStrength =
    args.viewerRole === "student"
      ? profileStrengthForStudent(
          (user ?? {}) as Record<string, unknown>,
          (studentProfile ?? {}) as Record<string, unknown>
        )
      : profileStrengthForCompany(
          (user ?? {}) as Record<string, unknown>,
          (companyProfile ?? {}) as Record<string, unknown>
        );

  const currentLocation =
    args.viewerRole === "student"
      ? `${String(studentProfile?.location ?? "")}${
          studentProfile?.country ? `, ${String(studentProfile.country)}` : ""
        }`.trim()
      : `${String(companyProfile?.location ?? "")}${
          companyProfile?.country ? `, ${String(companyProfile.country)}` : ""
        }`.trim();

  return {
    currentProfile: {
      id: String(user?._id ?? args.viewerId),
      name: String(user?.name ?? ""),
      username: String(user?.username ?? ""),
      role: String(user?.role ?? args.viewerRole),
      image: String(user?.image ?? ""),
      location: currentLocation,
      applicationProgress,
      profileStrength,
    },
    opportunities,
    peopleLikeYou,
  };
}

