import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

type SuggestedFollow = {
  id: string;
  name: string;
  username: string;
  role: string;
  image: string;
  headline: string;
};

type CurrentProfileSidebar = {
  id: string;
  name: string;
  username: string;
  role: string;
  image: string;
  skills: string[];
  location: string;
  views: number;
  followersCount: number;
  followingCount: number;
};

function splitKeywords(values: string[]) {
  const result = new Set<string>();
  for (const value of values) {
    for (const token of value.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length >= 2) result.add(token);
    }
  }
  return [...result];
}

function hasSkillOverlap(source: string[], target: string[]) {
  if (source.length === 0 || target.length === 0) return false;
  const sourceSet = new Set(source.map((item) => item.toLowerCase()));
  return target.some((item) => sourceSet.has(item.toLowerCase()));
}

export async function getHomeSidebarData(args: {
  viewerId: string;
  viewerRole: string;
}): Promise<{
  currentProfile: CurrentProfileSidebar;
  suggestions: SuggestedFollow[];
}> {
  const db = await getDb();
  const viewerObjectId = new ObjectId(args.viewerId);

  const [
    user,
    followingRows,
    studentProfile,
    companyProfile,
    ownInternships,
    viewsCount,
    followersCount,
    followingCount,
  ] =
    await Promise.all([
      db
        .collection("users")
        .findOne(
          { _id: viewerObjectId },
          { projection: { _id: 1, name: 1, username: 1, role: 1, image: 1 } }
        ),
      db
        .collection("connections")
        .find({ fromUserId: viewerObjectId })
        .project({ toUserId: 1 })
        .toArray(),
      db.collection("studentProfiles").findOne({ userId: viewerObjectId }),
      db.collection("companyProfiles").findOne({ userId: viewerObjectId }),
      db
        .collection("internships")
        .find({ companyId: viewerObjectId })
        .project({ skillsRequired: 1 })
        .limit(50)
        .toArray(),
      db.collection("profileViews").countDocuments({ targetUserId: viewerObjectId }),
      db.collection("connections").countDocuments({ toUserId: viewerObjectId }),
      db.collection("connections").countDocuments({ fromUserId: viewerObjectId }),
    ]);

  const followingIds = followingRows
    .map((item) => item.toUserId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const excludeIds = [viewerObjectId, ...followingIds];

  const ownSkillsFromStudent = Array.isArray(studentProfile?.skills)
    ? studentProfile.skills.map(String)
    : [];
  const ownSkillsFromInternships = ownInternships.flatMap((item) =>
    Array.isArray(item.skillsRequired) ? item.skillsRequired.map(String) : []
  );
  const ownKeywords =
    args.viewerRole === "student"
      ? splitKeywords(ownSkillsFromStudent)
      : splitKeywords([
          ...(companyProfile?.industry ? [String(companyProfile.industry)] : []),
          ...ownSkillsFromInternships,
        ]);

  const roleFilter =
    args.viewerRole === "student" ? ["student", "company"] : ["student"];
  const candidates = await db
    .collection("users")
    .find({
      _id: { $nin: excludeIds },
      role: { $in: roleFilter },
    })
    .project({ _id: 1, name: 1, username: 1, role: 1, image: 1 })
    .limit(250)
    .toArray();

  const candidateIds = candidates.map((item) => item._id as ObjectId);
  const [candidateStudents, candidateCompanies, candidateInternships] = await Promise.all([
    candidateIds.length
      ? db
          .collection("studentProfiles")
          .find({ userId: { $in: candidateIds } })
          .project({ userId: 1, skills: 1, location: 1, country: 1, education: 1 })
          .toArray()
      : [],
    candidateIds.length
      ? db
          .collection("companyProfiles")
          .find({ userId: { $in: candidateIds } })
          .project({ userId: 1, companyName: 1, industry: 1, location: 1, country: 1 })
          .toArray()
      : [],
    candidateIds.length
      ? db
          .collection("internships")
          .find({ companyId: { $in: candidateIds } })
          .project({ companyId: 1, skillsRequired: 1 })
          .toArray()
      : [],
  ]);

  const studentMap = new Map(candidateStudents.map((item) => [item.userId.toString(), item]));
  const companyMap = new Map(candidateCompanies.map((item) => [item.userId.toString(), item]));
  const companySkillsMap = new Map<string, string[]>();
  for (const internship of candidateInternships) {
    const companyId = (internship.companyId as ObjectId).toString();
    const current = companySkillsMap.get(companyId) ?? [];
    const next = Array.isArray(internship.skillsRequired)
      ? [...current, ...internship.skillsRequired.map(String)]
      : current;
    companySkillsMap.set(companyId, next);
  }

  const suggestions: SuggestedFollow[] = [];
  for (const candidate of candidates) {
    if (!candidate.username) continue;
    const candidateId = candidate._id.toString();
    if (candidate.role === "student") {
      const profile = studentMap.get(candidateId);
      const candidateSkills = Array.isArray(profile?.skills) ? profile.skills.map(String) : [];
      if (ownKeywords.length > 0 && !hasSkillOverlap(ownKeywords, splitKeywords(candidateSkills))) {
        continue;
      }
      suggestions.push({
        id: candidateId,
        name: String(candidate.name ?? ""),
        username: String(candidate.username ?? ""),
        role: "student",
        image: String(candidate.image ?? ""),
        headline:
          profile?.education && String(profile.education).trim()
            ? String(profile.education)
            : `${String(profile?.location ?? "")}${profile?.country ? `, ${String(profile.country)}` : ""}`.trim(),
      });
    } else {
      const profile = companyMap.get(candidateId);
      const companySkills = companySkillsMap.get(candidateId) ?? [];
      const relatedByIndustry =
        ownKeywords.length === 0
          ? true
          : ownKeywords.some((keyword) =>
              String(profile?.industry ?? "").toLowerCase().includes(keyword)
            );
      const relatedBySkills = hasSkillOverlap(ownKeywords, splitKeywords(companySkills));
      if (ownKeywords.length > 0 && !relatedByIndustry && !relatedBySkills) {
        continue;
      }
      suggestions.push({
        id: candidateId,
        name: String(profile?.companyName ?? candidate.name ?? ""),
        username: String(candidate.username ?? ""),
        role: "company",
        image: String(candidate.image ?? ""),
        headline:
          profile?.industry && String(profile.industry).trim()
            ? String(profile.industry)
            : `${String(profile?.location ?? "")}${profile?.country ? `, ${String(profile.country)}` : ""}`.trim(),
      });
    }
    if (suggestions.length >= 8) break;
  }

  const currentSkills =
    args.viewerRole === "student"
      ? ownSkillsFromStudent.slice(0, 6)
      : [...new Set(ownSkillsFromInternships.map((item) => item.toLowerCase()))].slice(0, 6);
  const currentLocation =
    args.viewerRole === "student"
      ? `${String(studentProfile?.location ?? "")}${studentProfile?.country ? `, ${String(studentProfile.country)}` : ""}`.trim()
      : `${String(companyProfile?.location ?? "")}${companyProfile?.country ? `, ${String(companyProfile.country)}` : ""}`.trim();

  return {
    currentProfile: {
      id: String(user?._id ?? args.viewerId),
      name: String(user?.name ?? ""),
      username: String(user?.username ?? ""),
      role: String(user?.role ?? args.viewerRole),
      image: String(user?.image ?? ""),
      skills: currentSkills,
      location: currentLocation,
      views: viewsCount,
      followersCount,
      followingCount,
    },
    suggestions,
  };
}
