"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useState } from "react";

type Suggested = {
  id: string;
  name: string;
  username: string;
  role: string;
  image: string;
  headline: string;
};

export function SuggestedFollows({
  title,
  items: initialItems,
}: {
  title: string;
  items: Suggested[];
}) {
  const [items, setItems] = useState(initialItems);
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
        setItems((prev) => prev.filter((item) => item.id !== userId));
      } finally {
        setBusyId("");
      }
    });
  };

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No suggestions right now.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700">
                    {item.name ? item.name.charAt(0).toUpperCase() : "?"}
                  </span>
                )}

                <div className="min-w-0">
                  <Link
                    href={`/profiles/${item.username}`}
                    className="truncate text-sm font-semibold text-slate-900 transition hover:text-slate-700"
                  >
                    {item.name}
                  </Link>
                  <p className="truncate text-xs text-slate-600">{item.headline || item.role}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => follow(item.id)}
                disabled={busyId === item.id}
                className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                title="Follow"
                aria-label="Follow"
              >
                {busyId === item.id ? "Following..." : "Follow"}
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}