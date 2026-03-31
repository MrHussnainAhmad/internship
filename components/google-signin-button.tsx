"use client";

import { signIn } from "next-auth/react";

export function GoogleSignInButton() {
  return (
    <button
      type="button"
      title="Continue with Google"
      aria-label="Continue with Google"
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      className="inline-flex h-11 items-center justify-center gap-3 rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.8 4.8 0 0 1-2 3.1v2.6h3.3c1.9-1.7 3-4.3 3-7.5Z" />
        <path d="M12 22c2.7 0 5-1 6.7-2.6l-3.3-2.6c-.9.6-2 .9-3.4.9-2.6 0-4.7-1.7-5.4-4H3.2v2.6A10 10 0 0 0 12 22Z" />
        <path d="M6.6 13.7A6 6 0 0 1 6.3 12c0-.6.1-1.1.3-1.7V7.7H3.2A10 10 0 0 0 2 12c0 1.6.4 3.2 1.2 4.3l3.4-2.6Z" />
        <path d="M12 6.3c1.5 0 2.9.5 3.9 1.5l2.9-2.9A10 10 0 0 0 12 2a10 10 0 0 0-8.8 5.7l3.4 2.6c.7-2.3 2.8-4 5.4-4Z" />
      </svg>
      <span>Continue with Google</span>
      <span className="sr-only">Continue with Google</span>
    </button>
  );
}