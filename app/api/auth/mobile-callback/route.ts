import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUrl = url.searchParams.get("redirectUrl");
  if (!redirectUrl) {
    return NextResponse.json({ error: "Missing redirectUrl" }, { status: 400 });
  }

  const cookieStore = await cookies();
  // Get either the standard or the secure token depending on environment
  const sessionToken =
    cookieStore.get("next-auth.session-token")?.value ||
    cookieStore.get("__Secure-next-auth.session-token")?.value ||
    "";

  return NextResponse.redirect(`${redirectUrl}?token=${sessionToken}`);
}
