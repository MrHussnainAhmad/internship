"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import type { FeedItem } from "@/lib/feed";
import { PostCard } from "@/components/PostCard";
import { ApplyButton } from "@/components/apply-button";
import { ShareMenu } from "@/components/share-menu";
import { VerifiedBadge } from "@/components/verified-badge";
import { FEED_PREPEND_POST_EVENT, type FeedPrependPostDetail } from "@/lib/feed-events";

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
      className={`rounded-2xl border bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ${
        isHighMatch ? "border-emerald-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Internship
          </p>
          <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.01em] text-slate-900">
            {item.title}
          </h3>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm text-slate-600">{item.companyName}</p>
            {item.companyVerified ? <VerifiedBadge trustedLabel={false} /> : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              isHighMatch
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Match {item.matchPercent}%
          </p>
          <p className="mt-2 text-xs text-slate-500">{timeAgo(item.createdAt)}</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-700">
        {item.location}, {item.country}
        {item.isRemote ? " · Remote friendly" : ""}
      </p>

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{item.description}</p>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
          Why this is shown
        </p>
        <p className="mt-1 text-sm text-slate-700">{item.whyShown}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.skillsRequired.slice(0, 5).map((skill) => {
          const isMatched = item.matchedSkills.includes(skill);
          return (
            <span
              key={skill}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                isMatched
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {skill}
            </span>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {item.level}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <ShareMenu
            sharePath={`/internships/${item.slug}`}
            title={item.title}
            description={item.description}
            repostTarget={{ kind: "internship", internshipSlug: item.slug }}
          />
          <Link
            href={`/internships/${item.slug}`}
            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
  const [pinnedPosts, setPinnedPosts] = useState<Extract<FeedItem, { kind: "post" }>[]>([]);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(initialItems);
    setPinnedPosts([]);
    setHasMore(initialHasMore);
    setPage(initialPage);
    setError("");
  }, [initialItems, initialHasMore, initialPage]);

  useEffect(() => {
    const onPrepend = (event: Event) => {
      const custom = event as CustomEvent<FeedPrependPostDetail>;
      const post = custom.detail?.post;
      if (!post) return;
      setPinnedPosts((previous) => {
        const next = [post, ...previous.filter((item) => item.id !== post.id)];
        return next.slice(0, 3);
      });
      setItems((previous) => {
        if (previous.some((item) => item.kind === "post" && item.id === post.id)) {
          return previous;
        }
        return [post, ...previous];
      });
    };

    window.addEventListener(FEED_PREPEND_POST_EVENT, onPrepend as EventListener);
    return () => {
      window.removeEventListener(FEED_PREPEND_POST_EVENT, onPrepend as EventListener);
    };
  }, []);

  const pinnedPostIdSet = useMemo(
    () => new Set(pinnedPosts.map((post) => post.id)),
    [pinnedPosts]
  );

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
        <article className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          No feed items yet. Complete profile details to improve recommendations.
        </article>
      </section>
    );
  }

  if (viewerRole === "company") {
    return (
      <section className="space-y-6">
        <div className="space-y-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Feed
          </h2>

          {pinnedPosts.map((item) => (
            <PostCard key={`pinned-${item.id}`} item={item} />
          ))}

          {companyMixed.map((item) =>
            item.kind === "post" && pinnedPostIdSet.has(item.id) ? null : item.kind === "post" ? (
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
              title={loading ? "Loading" : "Load more"}
              aria-label={loading ? "Loading" : "Load more"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" className="opacity-30" />
                  <path d="M21 12a9 9 0 0 0-9-9" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14" />
                  <path d="m19 12-7 7-7-7" />
                </svg>
              )}
              <span className="sr-only">{loading ? "Loading..." : "Load more"}</span>
            </button>
          </div>
        ) : null}

        {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {pinnedPosts.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Just posted
          </h2>
          {pinnedPosts.map((item) => (
            <PostCard key={`pinned-${item.id}`} item={item} />
          ))}
        </div>
      ) : null}

      <div className="space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          High match internships
        </h2>

        {grouped.highMatch.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
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
              className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              More high-match internships
            </Link>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          Other internships
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
              className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              More internships
            </Link>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          Posts
        </h2>

        {grouped.posts
          .filter((item) => !pinnedPostIdSet.has(item.id))
          .map((item) => (
            <PostCard key={`${item.kind}-${item.id}`} item={item} />
          ))}
      </div>

      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            title={loading ? "Loading" : "Load more"}
            aria-label={loading ? "Loading" : "Load more"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" className="opacity-30" />
                <path d="M21 12a9 9 0 0 0-9-9" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14" />
                <path d="m19 12-7 7-7-7" />
              </svg>
            )}
            <span className="sr-only">{loading ? "Loading..." : "Load more"}</span>
          </button>
        </div>
      ) : null}

      {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
