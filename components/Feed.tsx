"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import type { FeedItem } from "@/lib/feed";
import { PostCard } from "@/components/PostCard";

type FeedProps = {
  initialItems: FeedItem[];
  initialHasMore: boolean;
  initialPage: number;
};

function InternshipCard({ item }: { item: Extract<FeedItem, { kind: "internship" }> }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Internship</p>
          <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
          <p className="text-sm text-slate-600">{item.companyName}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
          {item.type.replaceAll("_", " ")}
        </span>
      </div>
      <p className="text-sm text-slate-700">
        {item.location}, {item.country}
        {item.isRemote ? " • Remote friendly" : ""}
      </p>
      <p className="mt-2 line-clamp-3 text-sm text-slate-600">{item.description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.skillsRequired.slice(0, 4).map((skill) => (
          <span
            key={skill}
            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
          >
            {skill}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-500">{item.level}</span>
        <Link
          href={`/internships/${item.slug}`}
          className="text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          View details
        </Link>
      </div>
    </article>
  );
}

export function Feed({ initialItems, initialHasMore, initialPage }: FeedProps) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(initialItems);
    setHasMore(initialHasMore);
    setPage(initialPage);
    setError("");
  }, [initialItems, initialHasMore, initialPage]);

  const loadMore = () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError("");
    startTransition(async () => {
      try {
        const nextPage = page + 1;
        const response = await fetch(`/api/feed?page=${nextPage}&limit=10`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Could not load more feed items");
          return;
        }
        setItems((prev) => [...prev, ...(Array.isArray(data.items) ? data.items : [])]);
        setHasMore(Boolean(data.hasMore));
        setPage(nextPage);
      } catch {
        setError("Could not load more feed items");
      } finally {
        setLoading(false);
      }
    });
  };

  return (
    <section className="space-y-4">
      {items.length === 0 ? (
        <article className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          No feed items yet. Complete profile details to improve recommendations.
        </article>
      ) : (
        items.map((item) =>
          item.kind === "post" ? (
            <PostCard key={`${item.kind}-${item.id}`} item={item} />
          ) : (
            <InternshipCard key={`${item.kind}-${item.id}`} item={item} />
          )
        )
      )}

      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
