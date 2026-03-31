"use client";

import { signIn } from "next-auth/react";

const isDevAuthBypassEnabled =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

export function DevAuthBypassButtons() {
  if (!isDevAuthBypassEnabled) return null;

  return (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
        Development access
      </p>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => signIn("credentials", { role: "student", callbackUrl: "/dashboard" })}
          className="inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Continue as Student
        </button>

        <button
          type="button"
          onClick={() => signIn("credentials", { role: "company", callbackUrl: "/dashboard" })}
          className="inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Continue as Company
        </button>
      </div>
    </div>
  );
}