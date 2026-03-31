"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import type { FeedItem } from "@/lib/feed";
import { PostCard } from "@/components/PostCard";
import { ApplyButton } from "@/components/apply-button";
import { VerifiedBadge } from "@/components/verified-badge";

type FeedProps = {
  initialItems: FeedItem[];
  initialHasMore: boolean;
  initialPage: number;
  viewerRole: "student" | "company";
};

function timeAgo(iso: string) {
  const deltaSeconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function InternshipCard({
  item,
  canApply,
}: {
  item: Extract<FeedItem, { kind: "internship" }>;
  canApply: boolean;
}) {
  const isHighMatch = item.matchPercent >= 60;

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        isHighMatch ? "border-emerald-300" : "border-slate-200"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Internship</p>
          <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
          <div className="flex items-center gap-2">
            <p className="text-sm text-slate-600">{item.companyName}</p>
            {item.companyVerified ? <VerifiedBadge trustedLabel={false} /> : null}
          </div>
        </div>
        <div className="text-right">
          <p
            className={`rounded-full px-2 py-1 text-xs font-semibold ${
              isHighMatch
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Match {item.matchPercent}%
          </p>
          <p className="mt-1 text-xs text-slate-500">{timeAgo(item.createdAt)}</p>
        </div>
      </div>

      <p className="text-sm text-slate-700">
        {item.location}, {item.country}
        {item.isRemote ? " • Remote friendly" : ""}
      </p>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.description}</p>

      <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <p className="font-semibold text-slate-900">Why this is shown</p>
        <p>{item.whyShown}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {item.skillsRequired.slice(0, 5).map((skill) => {
          const isMatched = item.matchedSkills.includes(skill);
          return (
            <span
              key={skill}
              className={`rounded-full border px-2 py-1 text-xs ${
                isMatched
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {skill}
            </span>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-wide text-slate-500">{item.level}</span>
        <div className="flex items-center gap-2">
          <Link
            href={`/internships/${item.slug}`}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            View details
          </Link>
          {canApply ? <ApplyButton internshipSlug={item.slug} /> : null}
        </div>
      </div>
    </article>
  );
}

export function Feed({ initialItems, initialHasMore, initialPage, viewerRole }: FeedProps) {
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

  const grouped = useMemo(() => {
    const highMatch = items.filter(
      (item): item is Extract<FeedItem, { kind: "internship" }> =>
        item.kind === "internship" && item.section === "high_match_internships"
    );
    const otherInternships = items.filter(
      (item): item is Extract<FeedItem, { kind: "internship" }> =>
        item.kind === "internship" && item.section === "other_internships"
    );
    const posts = items.filter(
      (item): item is Extract<FeedItem, { kind: "post" }> => item.kind === "post"
    );

    return { highMatch, otherInternships, posts };
  }, [items]);
  const companyMixed = useMemo(() => {
    const internships = items.filter(
      (item): item is Extract<FeedItem, { kind: "internship" }> => item.kind === "internship"
    );
    const posts = items.filter(
      (item): item is Extract<FeedItem, { kind: "post" }> => item.kind === "post"
    );
    return [...internships, ...posts].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1
    );
  }, [items]);

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

  if (items.length === 0) {
    return (
      <section className="space-y-4">
        <article className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          No feed items yet. Complete profile details to improve recommendations.
        </article>
      </section>
    );
  }

  if (viewerRole === "company") {
    return (
      <section className="space-y-5">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Feed
          </h2>
          {companyMixed.map((item) =>
            item.kind === "post" ? (
              <PostCard key={`${item.kind}-${item.id}`} item={item} />
            ) : (
              <InternshipCard
                key={`${item.kind}-${item.id}`}
                item={item}
                canApply={false}
              />
            )
          )}
        </div>

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

  return (
    <section className="space-y-5">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          High Match Internships
        </h2>
        {grouped.highMatch.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No high-match internships yet. Add more skills to increase strong matches.
          </p>
        ) : (
          grouped.highMatch.slice(0, 2).map((item) => (
            <InternshipCard
              key={`${item.kind}-${item.id}`}
              item={item}
              canApply={viewerRole === "student"}
            />
          ))
        )}
        {grouped.highMatch.length > 2 ? (
          <div>
            <Link
              href="/internships"
              className="inline-flex rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              More high-match internships
            </Link>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Other Internships
        </h2>
        {grouped.otherInternships.slice(0, 2).map((item) => (
          <InternshipCard
            key={`${item.kind}-${item.id}`}
            item={item}
            canApply={viewerRole === "student"}
          />
        ))}
        {grouped.otherInternships.length > 2 ? (
          <div>
            <Link
              href="/internships"
              className="inline-flex rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              More internships
            </Link>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Normal Posts
        </h2>
        {grouped.posts.map((item) => (
          <PostCard key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </div>

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

