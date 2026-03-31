import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { formatInternshipTitle } from "@/lib/format";
import { toPublicPostId } from "@/lib/post-id";

type FeedSection =
  | "high_match_internships"
  | "other_internships"
  | "normal_posts";

type FeedItemPost = {
  id: string;
  publicId: string;
  kind: "post";
  section: "normal_posts";
  createdAt: string;
  topic: string;
  content: string;
  likesCount: number;
  commentsCount: number;
  shareCount: number;
  likedByViewer: boolean;
  repost?: {
    kind: "post" | "internship";
    sourcePath: string;
    originalAuthorName: string | undefined;
    originalAuthorUsername: string | undefined;
  };
  author: {
    id: string;
    name: string;
    username: string;
    role: string;
    image: string;
    isFollowing: boolean;
    canFollow: boolean;
  };
};

type FeedItemInternship = {
  id: string;
  kind: "internship";
  section: Exclude<FeedSection, "normal_posts">;
  createdAt: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  country: string;
  type: string;
  level: string;
  isRemote: boolean;
  companyName: string;
  companyVerified: boolean;
  skillsRequired: string[];
  matchedSkills: string[];
  matchPercent: number;
  whyShown: string;
};

export type FeedItem = FeedItemPost | FeedItemInternship;

export type FeedResponse = {
  items: FeedItem[];
  hasMore: boolean;
  page: number;
  limit: number;
  keywords: string[];
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toKeywords(values: string[]) {
  const tokens = new Set<string>();
  for (const value of values) {
    for (const token of value.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length >= 3) tokens.add(token);
    }
  }
  return [...tokens].slice(0, 8);
}

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

async function getViewerSignals(userId: ObjectId, role: string) {
  const db = await getDb();

  if (role === "student") {
    const profile = await db.collection("studentProfiles").findOne(
      { userId },
      { projection: { skills: 1 } }
    );
    const skills = normalizeSkills(profile?.skills);
    return {
      viewerSkills: skills,
      keywords: toKeywords(skills),
    };
  }

  if (role === "company") {
    const [companyProfile, internships] = await Promise.all([
      db.collection("companyProfiles").findOne(
        { userId },
        { projection: { industry: 1 } }
      ),
      db
        .collection("internships")
        .find({ companyId: userId }, { projection: { skillsRequired: 1 } })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray(),
    ]);

    const skills = internships.flatMap((row) => normalizeSkills(row.skillsRequired));
    const industry = companyProfile?.industry ? [String(companyProfile.industry)] : [];

    return {
      viewerSkills: [...new Set(skills)],
      keywords: toKeywords([...industry, ...skills]),
    };
  }

  return { viewerSkills: [], keywords: [] };
}

export async function queryHomeFeed(args: {
  viewerId: string;
  viewerRole: string;
  page?: number;
  limit?: number;
}): Promise<FeedResponse> {
  const db = await getDb();
  const page = Math.max(1, args.page ?? 1);
  const limit = Math.min(20, Math.max(1, args.limit ?? 10));
  const take = page * limit * 4;

  const viewerObjectId = new ObjectId(args.viewerId);
  const [{ viewerSkills, keywords }, followingRows] = await Promise.all([
    getViewerSignals(viewerObjectId, args.viewerRole),
    db
      .collection("connections")
      .find({ fromUserId: viewerObjectId })
      .project({ toUserId: 1 })
      .toArray(),
  ]);

  const followingIds = followingRows
    .map((row) => row.toUserId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const followingIdSet = new Set(followingIds.map((id) => id.toString()));
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

  const keywordRegexes = keywords.map((term) => new RegExp(escapeRegex(term), "i"));

  const followWhere = followingIds.length > 0 ? { authorId: { $in: followingIds } } : null;
  const relatedWhere =
    keywordRegexes.length > 0
      ? [{ topic: { $in: keywordRegexes } }, { content: { $in: keywordRegexes } }]
      : [];
  const postWhere =
    followWhere || relatedWhere.length > 0
      ? {
          $or: [
            { authorId: viewerObjectId },
            ...(followWhere ? [followWhere] : []),
            ...relatedWhere,
          ],
        }
      : { authorId: viewerObjectId };

  const posts = await db
    .collection("posts")
    .find(postWhere)
    .project({
      authorId: 1,
      topic: 1,
      content: 1,
      likes: 1,
      commentsCount: 1,
      shareCount: 1,
      repost: 1,
      createdAt: 1,
    })
    .sort({ createdAt: -1 })
    .limit(take)
    .toArray();

  const authorIds = [...new Set(posts.map((post) => String(post.authorId ?? "")).filter(Boolean))]
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));

  const authors = authorIds.length
    ? await db
        .collection("users")
        .find({ _id: { $in: authorIds } })
        .project({ _id: 1, name: 1, username: 1, role: 1, image: 1 })
        .toArray()
    : [];
  const authorMap = new Map(authors.map((author) => [author._id.toString(), author]));

  const postItems: FeedItemPost[] = posts.reduce<FeedItemPost[]>((items, post) => {
      const author = authorMap.get(String(post.authorId ?? ""));
      if (!author) return items;
      items.push({
        id: post._id.toString(),
        publicId: toPublicPostId(post._id.toString()),
        kind: "post" as const,
        section: "normal_posts" as const,
        createdAt: new Date(post.createdAt ?? Date.now()).toISOString(),
        topic: String(post.topic ?? ""),
        content: String(post.content ?? ""),
        likesCount: Array.isArray(post.likes) ? post.likes.length : 0,
        commentsCount: Number(post.commentsCount ?? 0),
        shareCount: Number(post.shareCount ?? 0),
        likedByViewer: Array.isArray(post.likes)
          ? post.likes.some((id) => String(id) === args.viewerId)
          : false,
        repost:
          post.repost && typeof post.repost === "object"
            ? {
                kind:
                  post.repost.kind === "internship" ? "internship" : "post",
                sourcePath: String(post.repost.sourcePath ?? ""),
                originalAuthorName: post.repost.originalAuthorName
                  ? String(post.repost.originalAuthorName)
                  : undefined,
                originalAuthorUsername: post.repost.originalAuthorUsername
                  ? String(post.repost.originalAuthorUsername)
                  : undefined,
              }
            : undefined,
        author: {
          id: author._id.toString(),
          name: String(author.name ?? ""),
          username: String(author.username ?? ""),
          role: String(author.role ?? ""),
          image: String(author.image ?? ""),
          isFollowing: followingIdSet.has(author._id.toString()),
          canFollow:
            author._id.toString() !== args.viewerId &&
            !followingIdSet.has(author._id.toString()),
        },
      });
      return items;
    }, []);

  const internships =
    viewerSkills.length === 0
      ? []
      : await db
          .collection("internships")
          .find({
            skillsRequired: { $in: viewerSkills },
            ...(appliedInternshipIds.length > 0
              ? { _id: { $nin: appliedInternshipIds } }
              : {}),
          })
          .project({
            slug: 1,
            title: 1,
            description: 1,
            location: 1,
            country: 1,
            type: 1,
            level: 1,
            isRemote: 1,
            skillsRequired: 1,
            companyId: 1,
            createdAt: 1,
          })
          .sort({ createdAt: -1 })
          .limit(take)
          .toArray();

  const companyIds = internships
    .map((internship) => internship.companyId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const companyProfiles = companyIds.length
    ? await db
        .collection("companyProfiles")
        .find({ userId: { $in: companyIds } })
        .project({ userId: 1, companyName: 1, verified: 1 })
        .toArray()
    : [];
  const companyMap = new Map(
    companyProfiles.map((company) => [company.userId.toString(), company])
  );

  const internshipItems: FeedItemInternship[] = internships
    .map((internship) => {
      const requiredSkills = normalizeSkills(internship.skillsRequired);
      const { matchedSkills, matchPercent } = calculateMatch(requiredSkills, viewerSkills);

      if (viewerSkills.length > 0 && matchedSkills.length === 0) {
        return null;
      }

      const section: FeedItemInternship["section"] =
        matchPercent >= 60 ? "high_match_internships" : "other_internships";

      return {
        id: internship._id.toString(),
        kind: "internship" as const,
        section,
        createdAt: new Date(internship.createdAt ?? Date.now()).toISOString(),
        slug: String(internship.slug ?? ""),
        title: formatInternshipTitle(String(internship.title ?? "")),
        description: String(internship.description ?? ""),
        location: String(internship.location ?? ""),
        country: String(internship.country ?? ""),
        type: String(internship.type ?? ""),
        level: String(internship.level ?? ""),
        isRemote: Boolean(internship.isRemote),
        companyName: String(
          companyMap.get(String(internship.companyId ?? ""))?.companyName ?? "Company"
        ),
        companyVerified: Boolean(
          companyMap.get(String(internship.companyId ?? ""))?.verified
        ),
        skillsRequired: requiredSkills,
        matchedSkills,
        matchPercent,
        whyShown:
          matchedSkills.length > 0
            ? `Matched skills: ${matchedSkills.slice(0, 3).join(", ")}`
            : "Shown because this internship is trending and recently posted.",
      };
    })
    .filter((item): item is FeedItemInternship => item !== null)
    .sort((a, b) => {
      if (a.section !== b.section) {
        return a.section === "high_match_internships" ? -1 : 1;
      }
      if (a.matchPercent !== b.matchPercent) return b.matchPercent - a.matchPercent;
      return a.createdAt < b.createdAt ? 1 : -1;
    });

  const highMatch = internshipItems.filter((item) => item.section === "high_match_internships");
  const otherMatch = internshipItems.filter((item) => item.section === "other_internships");

  const merged: FeedItem[] = [...highMatch, ...otherMatch, ...postItems];
  const from = (page - 1) * limit;
  const to = from + limit;

  return {
    items: merged.slice(from, to),
    hasMore: merged.length > to,
    page,
    limit,
    keywords,
  };
}

