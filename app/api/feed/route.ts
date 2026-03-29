import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { queryHomeFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const currentUser = await getApiUser(request);
  if (!currentUser?._id || !currentUser.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "10");
  const data = await queryHomeFeed({
    viewerId: currentUser._id.toString(),
    viewerRole: currentUser.role,
    page: Number.isFinite(page) ? page : 1,
    limit: Number.isFinite(limit) ? limit : 10,
  });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
