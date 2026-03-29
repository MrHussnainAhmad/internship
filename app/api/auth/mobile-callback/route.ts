import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUrl = url.searchParams.get('redirectUrl');

  if (!redirectUrl) {
    return NextResponse.json({ error: 'Missing redirectUrl' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get('next-auth.session-token')?.value ||
    cookieStore.get('__Secure-next-auth.session-token')?.value ||
    '';

  const deepLink = `${redirectUrl}${redirectUrl.includes('?') ? '&' : '?'}token=${sessionToken}`;

  const html = `<!DOCTYPE html>
<html>
  <head>
    <title>Redirecting...</title>
    <meta http-equiv="refresh" content="0;url=${deepLink}" />
  </head>
  <body>
    <script>window.location.replace(${JSON.stringify(deepLink)});</script>
    <p>Returning to app...</p>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}
