import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const schema = z.object({
  postId: z.string().min(1),
  content: z.string().trim().min(1).max(500),
  parentCommentId: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success || !ObjectId.isValid(parsed.data.postId)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (parsed.data.parentCommentId && !ObjectId.isValid(parsed.data.parentCommentId)) {
    return NextResponse.json({ error: "Invalid parent comment" }, { status: 400 });
  }

  const db = await getDb();
  const currentUser = await db.collection("users").findOne(
    { email: session.user.email },
    { projection: { _id: 1 } }
  );
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const postId = new ObjectId(parsed.data.postId);
  const postExists = await db
    .collection("posts")
    .findOne({ _id: postId }, { projection: { _id: 1 } });
  if (!postExists) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const now = new Date();
  await db.collection("postComments").insertOne({
    postId,
    authorId: currentUser._id,
    content: parsed.data.content,
    parentCommentId: parsed.data.parentCommentId
      ? new ObjectId(parsed.data.parentCommentId)
      : null,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("posts").updateOne(
    { _id: postId },
    {
      $inc: { commentsCount: 1 },
      $set: { updatedAt: now },
    }
  );

  return NextResponse.json({ ok: true });
}
