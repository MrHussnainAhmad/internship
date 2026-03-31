"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, startTransition, useEffect, useMemo, useState } from "react";
import type { FeedItem } from "@/lib/feed";
import { ShareMenu } from "@/components/share-menu";
import { FEED_PREPEND_POST_EVENT, type FeedPrependPostDetail } from "@/lib/feed-events";

type Props = {
  initialItems: FeedItem[];
  initialHasMore: boolean;
  initialPage: number;
  initialKeywords: string[];
};

type CommentItem = {
  id: string;
  postId: string;
  parentCommentId: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    username: string;
    image: string;
  };
};

function Avatar({
  name,
  image,
  size = 40,
}: {
  name: string;
  image?: string;
  size?: number;
}) {
  const safeName = name.trim();
  const initial = safeName ? safeName.charAt(0).toUpperCase() : "?";
  const classes = "rounded-full border border-slate-200 bg-slate-100 object-cover";
  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={size}
        height={size}
        className={classes}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700"
    >
      {initial}
    </span>
  );
}

function PostCard({ item }: { item: Extract<FeedItem, { kind: "post" }> }) {
  const [isFollowing, setIsFollowing] = useState(item.author.isFollowing);
  const [followBusy, setFollowBusy] = useState(false);
  const [liked, setLiked] = useState(item.likedByViewer);
  const [likesCount, setLikesCount] = useState(item.likesCount);
  const [commentsCount, setCommentsCount] = useState(item.commentsCount);
  const [shareCount, setShareCount] = useState(item.shareCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const followAuthor = () => {
    if (followBusy || !item.author.canFollow || isFollowing) return;
    setFollowBusy(true);
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/connections/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: item.author.id }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Could not follow user");
          return;
        }
        setIsFollowing(Boolean(data.connected));
      } catch {
        setError("Could not follow user");
      } finally {
        setFollowBusy(false);
      }
    });
  };

  const commentsByParent = useMemo(() => {
    const map = new Map<string, CommentItem[]>();
    for (const comment of comments) {
      const key = comment.parentCommentId || "root";
      const existing = map.get(key) ?? [];
      existing.push(comment);
      map.set(key, existing);
    }
    return map;
  }, [comments]);

  const loadComments = async () => {
    const response = await fetch(`/api/posts/comments?postId=${item.id}`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not load comments");
      return;
    }
    setComments(Array.isArray(data.comments) ? data.comments : []);
  };

  const toggleComments = () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next) {
      startTransition(async () => {
        await loadComments();
      });
    }
  };

  const toggleLike = () => {
    if (busy) return;
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!prevLiked);
    setLikesCount(Math.max(0, prevCount + (prevLiked ? -1 : 1)));
    setBusy(true);
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/posts/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: item.id }),
        });
        const data = await response.json();
        if (!response.ok) {
          setLiked(prevLiked);
          setLikesCount(prevCount);
          setError(data.error ?? "Could not update like");
          return;
        }
        setLiked(Boolean(data.liked));
        setLikesCount(Number(data.likesCount ?? 0));
      } catch {
        setLiked(prevLiked);
        setLikesCount(prevCount);
        setError("Could not update like");
      } finally {
        setBusy(false);
      }
    });
  };

  const submitComment = (event: FormEvent) => {
    event.preventDefault();
    if (!commentDraft.trim() || busy) return;
    setBusy(true);
    setError("");
    const draft = commentDraft;
    setCommentDraft("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/posts/comment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: item.id, content: draft }),
        });
        const data = await response.json();
        if (!response.ok) {
          setCommentDraft(draft);
          setError(data.error ?? "Could not publish comment");
          return;
        }
        setCommentsOpen(true);
        setCommentsCount((value) => value + 1);
        await loadComments();
      } catch {
        setCommentDraft(draft);
        setError("Could not publish comment");
      } finally {
        setBusy(false);
      }
    });
  };

  const submitReply = (event: FormEvent) => {
    event.preventDefault();
    if (!replyTo || !replyDraft.trim() || busy) return;
    setBusy(true);
    setError("");
    const draft = replyDraft;
    const parentCommentId = replyTo;
    setReplyDraft("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/posts/comment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: item.id, content: draft, parentCommentId }),
        });
        const data = await response.json();
        if (!response.ok) {
          setReplyDraft(draft);
          setError(data.error ?? "Could not publish reply");
          return;
        }
        setCommentsCount((value) => value + 1);
        setReplyTo("");
        await loadComments();
      } catch {
        setReplyDraft(draft);
        setError("Could not publish reply");
      } finally {
        setBusy(false);
      }
    });
  };

  const trackShare = async () => {
    const response = await fetch("/api/posts/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: item.id }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Could not share post");
    }
    setShareCount(Number(data.shareCount ?? 0));
  };

  const rootComments = commentsByParent.get("root") ?? [];
  const repostSourceLabel =
    item.repost?.kind === "post"
      ? item.repost.originalAuthorUsername
        ? `Original post by @${item.repost.originalAuthorUsername}`
        : item.repost.originalAuthorName
          ? `Original post by ${item.repost.originalAuthorName}`
          : "Original post"
      : item.repost?.kind === "internship"
        ? "Original internship"
        : "";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {item.repost?.sourcePath ? (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 1v4H7" />
              <path d="m3 5 4-4 4 4" />
              <path d="M7 23v-4h10" />
              <path d="m21 19-4 4-4-4" />
            </svg>
            Reposted
          </span>
          <Link href={item.repost.sourcePath} className="text-blue-700 hover:text-blue-900">
            {repostSourceLabel}
          </Link>
        </div>
      ) : null}

      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={item.author.name} image={item.author.image} size={42} />
          <div>
            <Link
              href={`/profiles/${item.author.username}`}
              className="text-sm font-semibold text-slate-900 hover:text-blue-700"
            >
              {item.author.name}
            </Link>
            <p className="text-xs text-slate-600">@{item.author.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {item.author.canFollow && !isFollowing ? (
            <button
              type="button"
              onClick={followAuthor}
              disabled={followBusy}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-700 text-white disabled:opacity-60"
            >
              <span className="text-sm font-semibold leading-none">
                {followBusy ? "…" : "+"}
              </span>
            </button>
          ) : null}
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
            {item.author.role}
          </span>
        </div>
      </div>

      {item.topic ? <p className="text-sm font-semibold text-slate-900">{item.topic}</p> : null}
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.content}</p>
      <p className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
        <span>{likesCount} likes</span>
        <span>{commentsCount} comments</span>
        <span>{shareCount} shares</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3">
        <button
          type="button"
          onClick={toggleLike}
          disabled={busy}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            liked ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"
          }`}
        >
          Like
        </button>
        <button
          type="button"
          onClick={toggleComments}
          className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700"
        >
          Comment
        </button>
        <ShareMenu
          sharePath={`/posts/${item.publicId}`}
          title={item.topic || "Post"}
          description={item.content}
          repostTarget={{ kind: "post", postId: item.id }}
          onTrackShare={trackShare}
          onError={(message) => setError(message)}
        />
      </div>

      {commentsOpen ? (
        <div className="mt-4 space-y-3 border-t border-slate-200 pt-3">
          <form onSubmit={submitComment} className="flex items-center gap-2">
            <input
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Write a comment..."
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !commentDraft.trim()}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Post
            </button>
          </form>

          {rootComments.length === 0 ? (
            <p className="text-sm text-slate-600">No comments yet.</p>
          ) : (
            <div className="space-y-3">
              {rootComments.map((comment) => {
                const replies = commentsByParent.get(comment.id) ?? [];
                return (
                  <div key={comment.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={comment.author.name}
                          image={comment.author.image}
                          size={28}
                        />
                        <Link
                          href={`/profiles/${comment.author.username}`}
                          className="text-sm font-semibold text-slate-900 hover:text-blue-700"
                        >
                          {comment.author.name}
                        </Link>
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{comment.content}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(comment.id);
                        setReplyDraft("");
                      }}
                      className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-900"
                    >
                      Reply
                    </button>

                    {replyTo === comment.id ? (
                      <form onSubmit={submitReply} className="mt-2 flex items-center gap-2">
                        <input
                          value={replyDraft}
                          onChange={(event) => setReplyDraft(event.target.value)}
                          placeholder="Write a reply..."
                          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                        <button
                          type="submit"
                          disabled={busy || !replyDraft.trim()}
                          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          Post
                        </button>
                      </form>
                    ) : null}

                    {replies.length > 0 ? (
                      <div className="mt-3 space-y-2 border-l border-slate-200 pl-3">
                        {replies.map((reply) => (
                          <div key={reply.id} className="rounded-md bg-slate-50 p-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Avatar
                                  name={reply.author.name}
                                  image={reply.author.image}
                                  size={22}
                                />
                                <Link
                                  href={`/profiles/${reply.author.username}`}
                                  className="text-xs font-semibold text-slate-900 hover:text-blue-700"
                                >
                                  {reply.author.name}
                                </Link>
                              </div>
                              <span className="text-[11px] text-slate-500">
                                {new Date(reply.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-700">{reply.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </article>
  );
}

function InternshipCard({
  item,
}: {
  item: Extract<FeedItem, { kind: "internship" }>;
}) {
  return (
    <article className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Internship</p>
          <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
          <p className="text-sm text-slate-600">{item.companyName}</p>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-700">
          {item.type.replaceAll("_", " ")}
        </span>
      </div>
      <p className="text-sm text-slate-700">
        {item.location}, {item.country}
        {item.isRemote ? " • Remote friendly" : ""}
      </p>
      <p className="mt-2 line-clamp-3 text-sm text-slate-600">{item.description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.skillsRequired.slice(0, 5).map((skill) => (
          <span
            key={skill}
            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
          >
            {skill}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-500">{item.level}</span>
        <div className="flex items-center gap-2">
          <ShareMenu
            sharePath={`/internships/${item.slug}`}
            title={item.title}
            description={item.description}
            repostTarget={{ kind: "internship", internshipSlug: item.slug }}
          />
          <Link
            href={`/internships/${item.slug}`}
            className="text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}

export function HomeFeed({
  initialItems,
  initialHasMore,
  initialPage,
  initialKeywords,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(initialItems);
    setPage(initialPage);
    setHasMore(initialHasMore);
    setError("");
  }, [initialItems, initialPage, initialHasMore]);

  useEffect(() => {
    const onPrepend = (event: Event) => {
      const custom = event as CustomEvent<FeedPrependPostDetail>;
      const post = custom.detail?.post;
      if (!post) return;
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
          setError(data.error ?? "Could not load more items");
          return;
        }

        setItems((previous) => [...previous, ...(data.items ?? [])]);
        setPage(nextPage);
        setHasMore(Boolean(data.hasMore));
      } catch {
        setError("Could not load more items");
      } finally {
        setLoading(false);
      }
    });
  };

  return (
    <section className="space-y-4">
      {initialKeywords.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Feed based on your interests
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {initialKeywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Your personalized feed is empty right now. Add profile details and check back.
        </div>
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
        <div className="flex justify-center pt-2">
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
