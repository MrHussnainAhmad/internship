"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function AccountMenu() {
  return (
    <details className="group relative">
      <summary
        title="Account"
        aria-label="Account"
        className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-[#D6DCE5] bg-[#F8FAFC] text-[#334155] transition hover:border-[#B8C2D1] hover:bg-white hover:text-[#0F172A] [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      </summary>

      <div className="absolute right-0 z-50 mt-2.5 min-w-[190px] overflow-hidden rounded-xl border border-[#D6DCE5] bg-white p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.10)]">
        <Link
          href="/profile"
          className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#1E293B] transition hover:bg-[#F1F5F9]"
        >
          Profile
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#1E293B] transition hover:bg-[#F1F5F9]"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}