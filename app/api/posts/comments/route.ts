import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const postId = request.nextUrl.searchParams.get("postId");
  const rootOnly = request.nextUrl.searchParams.get("rootOnly") === "true";
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "0");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(50, limitRaw) : 0;
  if (!postId || !ObjectId.isValid(postId)) {
    return NextResponse.json({ comments: [] });
  }

  const db = await getDb();
  const filter: Record<string, unknown> = { postId: new ObjectId(postId) };
  if (rootOnly) filter.parentCommentId = null;

  let query = db
    .collection("postComments")
    .find(filter)
    .project({ authorId: 1, content: 1, parentCommentId: 1, createdAt: 1 })
    .sort({ createdAt: rootOnly ? -1 : 1 });
  if (limit > 0) {
    query = query.limit(limit);
  }
  const rows = await query.toArray();

  if (rootOnly) {
    rows.reverse();
  }

  const authorIds = rows
    .map((row) => row.authorId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const users = authorIds.length
    ? await db
        .collection("users")
        .find({ _id: { $in: authorIds } })
        .project({ _id: 1, name: 1, username: 1, image: 1 })
        .toArray()
    : [];
  const userMap = new Map(users.map((user) => [user._id.toString(), user]));

  const comments = rows.map((row) => {
    const author = userMap.get(String(row.authorId ?? ""));
    return {
      id: row._id.toString(),
      postId: String(postId),
      parentCommentId: row.parentCommentId ? String(row.parentCommentId) : "",
      content: String(row.content ?? ""),
      createdAt: new Date(row.createdAt ?? Date.now()).toISOString(),
      author: {
        id: String(author?._id ?? ""),
        name: String(author?.name ?? "User"),
        username: String(author?.username ?? ""),
        image: String(author?.image ?? ""),
      },
    };
  });

  return NextResponse.json({ comments });
}
