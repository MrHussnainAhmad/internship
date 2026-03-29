"use client";

import { signIn } from "next-auth/react";

const isDevAuthBypassEnabled =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

export function DevAuthBypassButtons() {
  // DEV ONLY - remove after real auth integration.
  if (!isDevAuthBypassEnabled) return null;

  return (
    <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
      <button
        type="button"
        onClick={() => signIn("credentials", { role: "student", callbackUrl: "/dashboard" })}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Continue as Student (Dev)
      </button>
      <button
        type="button"
        onClick={() => signIn("credentials", { role: "company", callbackUrl: "/dashboard" })}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Continue as Company (Dev)
      </button>
    </div>
  );
}
