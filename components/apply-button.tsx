"use client";

import { useState, startTransition } from "react";

export function ApplyButton({ internshipSlug }: { internshipSlug: string }) {
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  const onApply = () => {
    setIsPending(true);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/internships/${internshipSlug}/apply`, {
          method: "POST",
        });
        const data = await response.json();
        if (!response.ok) {
          if (data.retryAfter) {
            setMessage(
              `${data.error ?? "Unable to apply right now"} Retry after ${new Date(
                data.retryAfter
              ).toLocaleString()}.`
            );
          } else {
            setMessage(data.error ?? "Unable to apply right now");
          }
          return;
        }
        setMessage("Application submitted successfully.");
      } catch {
        setMessage("Something went wrong. Please try again.");
      } finally {
        setIsPending(false);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        title={isPending ? "Applying" : "Apply"}
        aria-label={isPending ? "Applying" : "Apply"}
        onClick={onApply}
        disabled={isPending}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
      >
        {isPending ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" className="opacity-30" />
            <path d="M21 12a9 9 0 0 0-9-9" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
        )}
        <span>{isPending ? "Applying..." : "Apply now"}</span>
      </button>
      {message ? <p className="text-right text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
