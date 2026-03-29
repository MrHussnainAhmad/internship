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
    <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No suggestions right now.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-2 rounded-md border border-slate-200 p-2"
            >
              <div className="flex items-start gap-2">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700">
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
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-700 text-white disabled:opacity-60"
                title="Follow"
                aria-label="Follow"
              >
                <span className="text-sm font-semibold leading-none">
                  {busyId === item.id ? "…" : "+"}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
