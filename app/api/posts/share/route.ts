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
  const postId = new ObjectId(parsed.data.postId);
  const update = await db.collection("posts").findOneAndUpdate(
    { _id: postId },
    {
      $inc: { shareCount: 1 },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after", projection: { shareCount: 1 } }
  );

  if (!update) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    shareCount: Number(update.shareCount ?? 0),
  });
}
