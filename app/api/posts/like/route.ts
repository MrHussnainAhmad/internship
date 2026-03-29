import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const schema = z.object({
  postId: z.string().min(1),
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

  const db = await getDb();
  const currentUser = await db
    .collection("users")
    .findOne({ email: session.user.email }, { projection: { _id: 1 } });
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const postId = new ObjectId(parsed.data.postId);
  const post = await db
    .collection("posts")
    .findOne({ _id: postId }, { projection: { _id: 1, likes: 1 } });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const likes = Array.isArray(post.likes)
    ? post.likes.filter((id): id is ObjectId => id instanceof ObjectId)
    : [];
  const liked = likes.some((id) => String(id) === currentUser._id.toString());
  const nextLikes = liked
    ? likes.filter((id) => String(id) !== currentUser._id.toString())
    : [...likes, currentUser._id];

  await db.collection("posts").updateOne(
    { _id: postId },
    {
      $set: {
        likes: nextLikes,
        updatedAt: new Date(),
      },
    }
  );

  const updated = await db
    .collection("posts")
    .findOne({ _id: postId }, { projection: { likes: 1 } });

  return NextResponse.json({
    ok: true,
    liked: !liked,
    likesCount: Array.isArray(updated?.likes) ? updated.likes.length : 0,
  });
}
