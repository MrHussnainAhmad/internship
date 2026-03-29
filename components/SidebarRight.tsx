"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useState } from "react";

type SuggestedUser = {
  id: string;
  name: string;
  username: string;
  role: string;
  image: string;
  headline: string;
};

export function SidebarRight({
  suggestions: initialSuggestions,
  showPostInternship,
}: {
  suggestions: SuggestedUser[];
  showPostInternship?: boolean;
}) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [busyId, setBusyId] = useState("");

  const follow = (userId: string) => {
    if (busyId) return;
    setBusyId(userId);
    startTransition(async () => {
      try {
        const response = await fetch("/api/connections/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: userId }),
        });
        const data = await response.json();
        if (!response.ok || !data.connected) return;
        setSuggestions((prev) => prev.filter((item) => item.id !== userId));
      } finally {
        setBusyId("");
      }
    });
  };

  return (
    <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
      {showPostInternship ? (
        <section className="px-1 py-2">
          <Link
            href="/internships/new"
            className="inline-flex w-full items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Post new internship
          </Link>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">People to follow</h2>
        {suggestions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No suggestions right now.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {suggestions.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
                      {item.name ? item.name.charAt(0).toUpperCase() : "?"}
                    </span>
                  )}
                  <div>
                    <Link
                      href={`/profiles/${item.username}`}
                      className="text-sm font-semibold text-slate-900 hover:text-blue-700"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-slate-600">{item.headline || item.role}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => follow(item.id)}
                  disabled={busyId === item.id}
                  className="rounded-full border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700 disabled:opacity-60"
                >
                  {busyId === item.id ? "..." : "Follow"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Tips</h3>
        <ul className="mt-2 space-y-2 text-sm text-slate-600">
          <li>Complete your profile details for better matches.</li>
          <li>Post regularly to increase profile reach.</li>
          <li>Connect with relevant people to expand opportunities.</li>
        </ul>
      </section>
    </aside>
  );
}
