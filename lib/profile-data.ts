import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export async function getProfileByUsername(args: {
  username: string;
  viewerUserId?: string;
}) {
  const db = await getDb();
  const username = args.username.trim().toLowerCase();
  const user = await db.collection("users").findOne(
    { username },
    { projection: { _id: 1, name: 1, email: 1, username: 1, role: 1, image: 1, bio: 1 } }
  );
  if (!user) return null;

  const userId = user._id as ObjectId;
  const [studentProfile, companyProfile, followersCount, followingCount, posts, followersRows, followingRows] =
    await Promise.all([
      db.collection("studentProfiles").findOne({ userId }),
      db.collection("companyProfiles").findOne({ userId }),
      db.collection("connections").countDocuments({ toUserId: userId }),
      db.collection("connections").countDocuments({ fromUserId: userId }),
      db
        .collection("posts")
        .find({ authorId: userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray(),
      db
        .collection("connections")
        .find({ toUserId: userId })
        .project({ fromUserId: 1 })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
      db
        .collection("connections")
        .find({ fromUserId: userId })
        .project({ toUserId: 1 })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
    ]);

  const followerIds = followersRows
    .map((row) => row.fromUserId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const followingIds = followingRows
    .map((row) => row.toUserId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const [followerUsers, followingUsers] = await Promise.all([
    followerIds.length
      ? db
          .collection("users")
          .find({ _id: { $in: followerIds } })
          .project({ _id: 1, name: 1, username: 1, role: 1, image: 1 })
          .toArray()
      : [],
    followingIds.length
      ? db
          .collection("users")
          .find({ _id: { $in: followingIds } })
          .project({ _id: 1, name: 1, username: 1, role: 1, image: 1 })
          .toArray()
      : [],
  ]);
  const followerMap = new Map(followerUsers.map((row) => [row._id.toString(), row]));
  const followingMap = new Map(followingUsers.map((row) => [row._id.toString(), row]));

  let connected = false;
  if (args.viewerUserId && ObjectId.isValid(args.viewerUserId)) {
    connected = Boolean(
      await db.collection("connections").findOne({
        fromUserId: new ObjectId(args.viewerUserId),
        toUserId: userId,
      })
    );
  }

  return {
    user: {
      id: userId.toString(),
      name: String(user.name ?? ""),
      email: String(user.email ?? ""),
      username: String(user.username ?? ""),
      role: String(user.role ?? ""),
      image: user.image ? String(user.image) : "",
      bio: user.bio ? String(user.bio) : "",
    },
    studentProfile: studentProfile
      ? {
          level: String(studentProfile.level ?? ""),
          education: String(studentProfile.education ?? ""),
          location: String(studentProfile.location ?? ""),
          country: String(studentProfile.country ?? ""),
          preferredType: String(studentProfile.preferredType ?? ""),
          skills: Array.isArray(studentProfile.skills)
            ? studentProfile.skills.map(String)
            : [],
          portfolioUrl: String(studentProfile.portfolioUrl ?? ""),
          linkedinUrl: String(studentProfile.linkedinUrl ?? ""),
          twitterUrl: String(studentProfile.twitterUrl ?? ""),
          instagramUrl: String(studentProfile.instagramUrl ?? ""),
        }
      : null,
    companyProfile: companyProfile
      ? {
          companyName: String(companyProfile.companyName ?? ""),
          industry: String(companyProfile.industry ?? ""),
          location: String(companyProfile.location ?? ""),
          country: String(companyProfile.country ?? ""),
          isRemote: Boolean(companyProfile.isRemote),
          description: String(companyProfile.description ?? ""),
          websiteUrl: String(companyProfile.websiteUrl ?? ""),
          linkedinUrl: String(companyProfile.linkedinUrl ?? ""),
          twitterUrl: String(companyProfile.twitterUrl ?? ""),
          instagramUrl: String(companyProfile.instagramUrl ?? ""),
        }
      : null,
    followersCount,
    followingCount,
    connected,
    followers: followerIds
      .map((id) => followerMap.get(id.toString()))
      .filter(isDefined)
      .map((user) => ({
        id: user._id.toString(),
        name: String(user.name ?? ""),
        username: String(user.username ?? ""),
        role: String(user.role ?? ""),
      })),
    following: followingIds
      .map((id) => followingMap.get(id.toString()))
      .filter(isDefined)
      .map((user) => ({
        id: user._id.toString(),
        name: String(user.name ?? ""),
        username: String(user.username ?? ""),
        role: String(user.role ?? ""),
      })),
    posts: posts.map((post) => ({
      id: post._id.toString(),
      topic: String(post.topic ?? ""),
      content: String(post.content ?? ""),
      createdAt: new Date(post.createdAt ?? Date.now()).toISOString(),
    })),
  };
}
