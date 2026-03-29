import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const currentUser = await getApiUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const views = await db.collection("profileViews").countDocuments({ targetUserId: currentUser._id });
  return NextResponse.json({ views });
}
