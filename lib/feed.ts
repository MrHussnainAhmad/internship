import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { formatInternshipTitle } from "@/lib/format";

type FeedItemPost = {
  id: string;
  kind: "post";
  createdAt: string;
  topic: string;
  content: string;
  likesCount: number;
  commentsCount: number;
  shareCount: number;
  likedByViewer: boolean;
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
  skillsRequired: string[];
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
  return [...tokens].slice(0, 6);
}

async function getViewerKeywords(userId: ObjectId, role: string) {
  const db = await getDb();

  if (role === "student") {
    const profile = await db.collection("studentProfiles").findOne(
      { userId },
      { projection: { skills: 1 } }
    );
    const skills = Array.isArray(profile?.skills) ? profile.skills.map(String) : [];
    return toKeywords(skills);
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
    const industry = companyProfile?.industry ? [String(companyProfile.industry)] : [];
    const internshipSkills = internships.flatMap((item) =>
      Array.isArray(item.skillsRequired) ? item.skillsRequired.map(String) : []
    );
    return toKeywords([...industry, ...internshipSkills]);
  }

  return [];
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
  const take = page * limit * 2;

  const viewerObjectId = new ObjectId(args.viewerId);
  const followingRows = await db
    .collection("connections")
    .find({ fromUserId: viewerObjectId })
    .project({ toUserId: 1 })
    .toArray();
  const followingIds = followingRows
    .map((row) => row.toUserId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const followingIdSet = new Set(followingIds.map((id) => id.toString()));

  const keywords = await getViewerKeywords(viewerObjectId, args.viewerRole);
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

  const postItems: FeedItemPost[] = posts
    .map((post) => {
      const author = authorMap.get(String(post.authorId ?? ""));
      if (!author) return null;
      return {
        id: post._id.toString(),
        kind: "post" as const,
        createdAt: new Date(post.createdAt ?? Date.now()).toISOString(),
        topic: String(post.topic ?? ""),
        content: String(post.content ?? ""),
        likesCount: Array.isArray(post.likes) ? post.likes.length : 0,
        commentsCount: Number(post.commentsCount ?? 0),
        shareCount: Number(post.shareCount ?? 0),
        likedByViewer: Array.isArray(post.likes)
          ? post.likes.some((id) => String(id) === args.viewerId)
          : false,
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
      };
    })
    .filter((item): item is FeedItemPost => item !== null);

  let internshipItems: FeedItemInternship[] = [];
  if (args.viewerRole === "student") {
    const internshipWhere =
      keywords.length > 0 ? { skillsRequired: { $in: keywords } } : {};
    const internships = await db
      .collection("internships")
      .find(internshipWhere)
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
          .project({ userId: 1, companyName: 1 })
          .toArray()
      : [];
    const companyMap = new Map(
      companyProfiles.map((company) => [company.userId.toString(), String(company.companyName ?? "Company")])
    );

    internshipItems = internships.map((internship) => ({
      id: internship._id.toString(),
      kind: "internship" as const,
      createdAt: new Date(internship.createdAt ?? Date.now()).toISOString(),
      slug: String(internship.slug ?? ""),
      title: formatInternshipTitle(String(internship.title ?? "")),
      description: String(internship.description ?? ""),
      location: String(internship.location ?? ""),
      country: String(internship.country ?? ""),
      type: String(internship.type ?? ""),
      level: String(internship.level ?? ""),
      isRemote: Boolean(internship.isRemote),
      companyName: companyMap.get(String(internship.companyId ?? "")) ?? "Company",
      skillsRequired: Array.isArray(internship.skillsRequired)
        ? internship.skillsRequired.map(String)
        : [],
    }));
  }

  const merged = [...postItems, ...internshipItems].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
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
