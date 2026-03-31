"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function AccountMenu() {
  return (
    <details className="group relative">
      <summary
        title="Account"
        aria-label="Account"
        className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      </summary>

      <div className="absolute right-0 z-50 mt-3 min-w-[180px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
        <Link
          href="/profile"
          className="block px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
        >
          Profile
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}