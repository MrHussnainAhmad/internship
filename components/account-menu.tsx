"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function AccountMenu() {
  return (
    <details className="relative">
      <summary
        title="Account"
        aria-label="Account"
        className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      </summary>
      <div className="absolute right-0 z-50 mt-2 min-w-32 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
        <Link
          href="/profile"
          className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          Profile
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}
