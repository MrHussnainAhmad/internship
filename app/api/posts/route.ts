import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { ensureIndexes } from "@/lib/indexes";

const postSchema = z.object({
  content: z.string().trim().min(3).max(800),
  topic: z.string().trim().max(80).optional().or(z.literal("")),
});

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")?.trim().toLowerCase();
  if (!username) {
    return NextResponse.json({ posts: [] });
  }

  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ username }, { projection: { _id: 1, name: 1, username: 1, role: 1 } });
  if (!user) return NextResponse.json({ posts: [] });

  const posts = await db
    .collection("posts")
    .find({ authorId: user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json({
    posts: posts.map((post) => ({
      id: post._id.toString(),
      content: String(post.content ?? ""),
      topic: String(post.topic ?? ""),
      createdAt: new Date(post.createdAt ?? Date.now()).toISOString(),
      likesCount: Array.isArray(post.likes) ? post.likes.length : 0,
      commentsCount: Number(post.commentsCount ?? 0),
      shareCount: Number(post.shareCount ?? 0),
      author: {
        id: user._id.toString(),
        name: String(user.name ?? ""),
        username: String(user.username ?? ""),
        role: String(user.role ?? ""),
      },
    })),
  });
}

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid post payload" }, { status: 400 });
  }

  const db = await getDb();
  if (user.role !== "student" && user.role !== "company") {
    return NextResponse.json(
      { error: "Complete your profile before publishing posts" },
      { status: 403 }
    );
  }

  await ensureIndexes();

  const now = new Date();
  const normalizedTopic =
    typeof parsed.data.topic === "string" ? parsed.data.topic.trim() : "";
  const { insertedId } = await db.collection("posts").insertOne({
    authorId: user._id,
    content: parsed.data.content,
    topic: normalizedTopic,
    likes: [],
    commentsCount: 0,
    shareCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({
    ok: true,
    post: {
      id: insertedId.toString(),
      createdAt: now.toISOString(),
    },
  });
}
