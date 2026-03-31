import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/api-auth";
import { getDb } from "@/lib/db";

const schema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("post"),
      postId: z.string().min(1),
      caption: z.string().max(500).optional(),
    }),
    z.object({
      kind: z.literal("internship"),
      internshipSlug: z.string().trim().min(1),
      caption: z.string().max(500).optional(),
    }),
  ])
  .transform((value) => ({
    ...value,
    caption: value.caption?.trim() ?? "",
  }));

function trimWithEllipsis(value: string, max: number) {
  if (value.length <= max) return value;
  if (max <= 3) return value.slice(0, max);
  return `${value.slice(0, max - 3)}...`;
}

function buildRepostContent(input: {
  caption: string;
  sourceTitle: string;
  sourceSummary: string;
  sourcePath: string;
}) {
  const lines: string[] = [];
  if (input.caption) lines.push(input.caption, "");
  lines.push(`Repost: ${input.sourceTitle}`);
  if (input.sourceSummary) lines.push(input.sourceSummary);
  lines.push(input.sourcePath);

  const joined = lines.join("\n");
  return trimWithEllipsis(joined, 800);
}

export async function POST(request: Request) {
  const currentUser = await getApiUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date();
  const payload = parsed.data;

  if (payload.kind === "post") {
    if (!ObjectId.isValid(payload.postId)) {
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
    }

    const postId = new ObjectId(payload.postId);
    const post = await db.collection("posts").findOne(
      { _id: postId },
      { projection: { _id: 1, authorId: 1, topic: 1, content: 1 } }
    );
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const author = post.authorId
      ? await db.collection("users").findOne(
          { _id: post.authorId },
          { projection: { username: 1, name: 1 } }
        )
      : null;
    const authorName = String(author?.name ?? "User");
    const authorUsername = String(author?.username ?? "");
    const sourceTitle = post.topic
      ? `${post.topic} by ${authorName}`
      : `Post by ${authorName}`;
    const sourceSummary = trimWithEllipsis(String(post.content ?? "").trim(), 220);
    const sourcePath = `/posts/${post._id.toString()}`;
    const topic = trimWithEllipsis(`Repost: ${String(post.topic ?? "Post").trim() || "Post"}`, 80);

    const content = buildRepostContent({
      caption: payload.caption,
      sourceTitle,
      sourceSummary,
      sourcePath,
    });

    const result = await db.collection("posts").insertOne({
      authorId: currentUser._id,
      topic,
      content,
      likes: [],
      commentsCount: 0,
      shareCount: 0,
      repost: {
        kind: "post",
        postId,
        originalAuthorId: post.authorId instanceof ObjectId ? post.authorId : null,
        originalAuthorName: authorName,
        originalAuthorUsername: authorUsername,
        sourcePath,
      },
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      ok: true,
      repostId: result.insertedId.toString(),
    });
  }

  const internship = await db.collection("internships").findOne(
    { slug: payload.internshipSlug },
    { projection: { _id: 1, slug: 1, title: 1, description: 1 } }
  );
  if (!internship) {
    return NextResponse.json({ error: "Internship not found" }, { status: 404 });
  }

  const title = String(internship.title ?? "Internship");
  const sourceSummary = trimWithEllipsis(String(internship.description ?? "").trim(), 220);
  const sourcePath = `/internships/${String(internship.slug ?? "")}`;
  const topic = trimWithEllipsis(`Repost: ${title}`, 80);
  const content = buildRepostContent({
    caption: payload.caption,
    sourceTitle: title,
    sourceSummary,
    sourcePath,
  });

  const result = await db.collection("posts").insertOne({
    authorId: currentUser._id,
    topic,
    content,
    likes: [],
    commentsCount: 0,
    shareCount: 0,
    repost: {
      kind: "internship",
      internshipId: internship._id,
      internshipSlug: String(internship.slug ?? ""),
      sourcePath,
    },
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({
    ok: true,
    repostId: result.insertedId.toString(),
  });
}
