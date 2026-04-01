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
    <article className="overflow-hidden rounded-xl border border-[#D6DCE5] bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <div className="border-b border-[#E2E8F0] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2563EB]">
              Opportunity
            </p>
            <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-[#0F172A]">
              {item.title}
            </h3>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-sm text-[#475569]">{item.companyName}</p>
              {item.companyVerified ? <VerifiedBadge trustedLabel={false} /> : null}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <span
              className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${
                isHighMatch
                  ? "bg-[#DBEAFE] text-[#1D4ED8]"
                  : "bg-[#F1F5F9] text-[#475569]"
              }`}
            >
              Match {item.matchPercent}%
            </span>
            <p className="mt-2 text-xs text-[#64748B]">{timeAgo(item.createdAt)}</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        <p className="text-sm text-[#334155]">
          {item.location}, {item.country}
          {item.isRemote ? " · Remote friendly" : ""}
        </p>

        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#475569]">{item.description}</p>

        <div className="mt-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">
            Why this is shown
          </p>
          <p className="mt-1 text-sm text-[#334155]">{item.whyShown}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {item.skillsRequired.slice(0, 5).map((skill) => {
            const isMatched = item.matchedSkills.includes(skill);
            return (
              <span
                key={skill}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                  isMatched
                    ? "border-[#93C5FD] bg-[#EFF6FF] text-[#1D4ED8]"
                    : "border-[#E2E8F0] bg-white text-[#475569]"
                }`}
              >
                {skill}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-[#E2E8F0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">
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
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#D6DCE5] px-4 text-sm font-semibold text-[#334155] transition hover:bg-[#F8FAFC]"
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
        <article className="rounded-xl border border-[#D6DCE5] bg-white p-6 text-sm text-[#475569] shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          No feed items yet. Complete profile details to improve recommendations.
        </article>
      </section>
    );
  }

  if (viewerRole === "company") {
    return (
      <section className="space-y-6">
        <div className="space-y-4">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">
            Feed
          </h2>

          {pinnedPosts.map((item) => (
            <PostCard key={`pinned-${item.id}`} item={item} />
          ))}

          {companyMixed.map((item) =>
            item.kind === "post" && pinnedPostIdSet.has(item.id) ? null :
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
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#D6DCE5] bg-white px-5 text-sm font-semibold text-[#334155] transition hover:bg-[#F8FAFC] disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
        ) : null}

        {error ? <p className="text-center text-sm text-[#DC2626]">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {pinnedPosts.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">
            Just posted
          </h2>
          {pinnedPosts.map((item) => (
            <PostCard key={`pinned-${item.id}`} item={item} />
          ))}
        </div>
      ) : null}

      <div className="space-y-4">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">
          High match internships
        </h2>

        {grouped.highMatch.length === 0 ? (
          <p className="rounded-xl border border-[#D6DCE5] bg-white p-4 text-sm text-[#475569]">
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
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#D6DCE5] px-4 text-xs font-semibold text-[#334155] transition hover:bg-[#F8FAFC]"
            >
              More high-match internships
            </Link>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">
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
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#D6DCE5] px-4 text-xs font-semibold text-[#334155] transition hover:bg-[#F8FAFC]"
            >
              More internships
            </Link>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">
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
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#D6DCE5] bg-white px-5 text-sm font-semibold text-[#334155] transition hover:bg-[#F8FAFC] disabled:opacity-60"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-center text-sm text-[#DC2626]">{error}</p> : null}
    </section>
  );
}