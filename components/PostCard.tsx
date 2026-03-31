"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, startTransition, useEffect, useMemo, useState } from "react";
import type { FeedItem } from "@/lib/feed";
import { ShareMenu } from "@/components/share-menu";

type PostItem = Extract<FeedItem, { kind: "post" }>;

type CommentItem = {
  id: string;
  parentCommentId: string;
  content: string;
  createdAt: string;
  author: {
    name: string;
    username: string;
    image: string;
  };
};

function Avatar({ name, image }: { name: string; image?: string }) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={44}
        height={44}
        className="h-11 w-11 rounded-full border border-slate-200 object-cover"
      />
    );
  }
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
      {name ? name.charAt(0).toUpperCase() : "?"}
    </span>
  );
}

export function PostCard({ item }: { item: PostItem }) {
  const [liked, setLiked] = useState(item.likedByViewer);
  const [likesCount, setLikesCount] = useState(item.likesCount);
  const [commentsCount, setCommentsCount] = useState(item.commentsCount);
  const [shareCount, setShareCount] = useState(item.shareCount);
  const [isFollowing, setIsFollowing] = useState(item.author.isFollowing);
  const [followBusy, setFollowBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [previewComments, setPreviewComments] = useState<CommentItem[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [error, setError] = useState("");

  const commentsByParent = useMemo(() => {
    const map = new Map<string, CommentItem[]>();
    for (const comment of comments) {
      const key = comment.parentCommentId || "root";
      const list = map.get(key) ?? [];
      list.push(comment);
      map.set(key, list);
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

  const loadPreviewComments = async () => {
    if (commentsCount <= 0) {
      setPreviewComments([]);
      return;
    }
    const response = await fetch(
      `/api/posts/comments?postId=${item.id}&rootOnly=true&limit=3`,
      {
        cache: "no-store",
      }
    );
    const data = await response.json();
    if (!response.ok) return;
    setPreviewComments(Array.isArray(data.comments) ? data.comments : []);
  };

  useEffect(() => {
    void loadPreviewComments();
  }, [item.id, commentsCount]);

  const onFollow = () => {
    if (followBusy || isFollowing || !item.author.canFollow) return;
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

  const onLike = () => {
    if (busy) return;
    const prevLiked = liked;
    const prevLikes = likesCount;
    setLiked(!prevLiked);
    setLikesCount(Math.max(0, prevLikes + (prevLiked ? -1 : 1)));
    setBusy(true);
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
          setLikesCount(prevLikes);
          setError(data.error ?? "Could not update like");
          return;
        }
        setLiked(Boolean(data.liked));
        setLikesCount(Number(data.likesCount ?? 0));
      } catch {
        setLiked(prevLiked);
        setLikesCount(prevLikes);
        setError("Could not update like");
      } finally {
        setBusy(false);
      }
    });
  };

  const onToggleComments = () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next) {
      startTransition(async () => {
        await loadComments();
      });
    }
  };

  const onComment = (event: FormEvent) => {
    event.preventDefault();
    if (!commentDraft.trim() || busy) return;
    const text = commentDraft;
    setCommentDraft("");
    setBusy(true);
    startTransition(async () => {
      try {
        const response = await fetch("/api/posts/comment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: item.id, content: text }),
        });
        const data = await response.json();
        if (!response.ok) {
          setCommentDraft(text);
          setError(data.error ?? "Could not publish comment");
          return;
        }
        setCommentsCount((value) => value + 1);
        setCommentsOpen(true);
        await loadComments();
        await loadPreviewComments();
      } catch {
        setCommentDraft(text);
        setError("Could not publish comment");
      } finally {
        setBusy(false);
      }
    });
  };

  const onReply = (event: FormEvent) => {
    event.preventDefault();
    if (!replyDraft.trim() || !replyTo || busy) return;
    const text = replyDraft;
    setReplyDraft("");
    setBusy(true);
    startTransition(async () => {
      try {
        const response = await fetch("/api/posts/comment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: item.id,
            content: text,
            parentCommentId: replyTo,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          setReplyDraft(text);
          setError(data.error ?? "Could not publish reply");
          return;
        }
        setReplyTo("");
        setCommentsCount((value) => value + 1);
        await loadComments();
        await loadPreviewComments();
      } catch {
        setReplyDraft(text);
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
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      {item.repost?.sourcePath ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 1v4H7" />
              <path d="m3 5 4-4 4 4" />
              <path d="M7 23v-4h10" />
              <path d="m21 19-4 4-4-4" />
            </svg>
            Reposted
          </span>
          <Link href={item.repost.sourcePath} className="font-medium text-slate-700 transition hover:text-slate-900">
            {repostSourceLabel}
          </Link>
        </div>
      ) : null}

      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={item.author.name} image={item.author.image} />
          <div className="min-w-0">
            <Link
              href={`/profiles/${item.author.username}`}
              className="truncate text-sm font-semibold text-slate-900 transition hover:text-slate-700"
            >
              {item.author.name}
            </Link>
            <p className="text-xs text-slate-500">
              {new Date(item.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {item.author.canFollow && !isFollowing ? (
          <button
            type="button"
            onClick={onFollow}
            disabled={followBusy}
            title={followBusy ? "Following" : "Follow"}
            aria-label={followBusy ? "Following" : "Follow"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {followBusy ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" className="opacity-30" />
                <path d="M21 12a9 9 0 0 0-9-9" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
            )}
            <span className="sr-only">{followBusy ? "Following..." : "Follow"}</span>
          </button>
        ) : null}
      </header>

      {item.topic ? <p className="text-[15px] font-semibold text-slate-900">{item.topic}</p> : null}
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.content}</p>

      <div className="mt-4 flex items-center gap-4 border-t border-slate-200 pt-4 text-xs text-slate-500">
        <span>{likesCount} likes</span>
        <span>{commentsCount} comments</span>
        <span>{shareCount} shares</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onLike}
          aria-label="Like"
          className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium transition ${
            liked
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 10h3V6a3 3 0 0 1 6 0v4h2.3a1.8 1.8 0 0 1 1.8 2.2l-1 4.8A3.2 3.2 0 0 1 16 20H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" />
          </svg>
          <span>Like</span>
        </button>

        <button
          type="button"
          onClick={onToggleComments}
          aria-label="Comments"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-100 px-3 text-sm text-slate-700 transition hover:bg-slate-200"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 14a3 3 0 0 1-3 3H9l-5 3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7Z" />
          </svg>
          <span>Comment</span>
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

      {!commentsOpen && previewComments.length > 0 ? (
        <section className="mt-4 space-y-2 border-t border-slate-200 pt-4">
          {previewComments.map((comment) => (
            <div key={comment.id} className="rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-xs font-semibold text-slate-900">{comment.author.name}</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-700">{comment.content}</p>
            </div>
          ))}
          <button
            type="button"
            onClick={onToggleComments}
            aria-label="View comments"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 6h13" />
              <path d="M8 12h13" />
              <path d="M8 18h13" />
              <path d="M3 6h.01" />
              <path d="M3 12h.01" />
              <path d="M3 18h.01" />
            </svg>
            <span className="sr-only">View comments</span>
          </button>
        </section>
      ) : null}

      {commentsOpen ? (
        <section className="mt-4 space-y-4 border-t border-slate-200 pt-4">
          <form onSubmit={onComment} className="flex items-center gap-2">
            <input
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Write a comment"
              className="h-11 flex-1 rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !commentDraft.trim()}
              aria-label="Post comment"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
              <span className="sr-only">Post</span>
            </button>
          </form>

          {rootComments.map((comment) => {
            const replies = commentsByParent.get(comment.id) ?? [];
            return (
              <div key={comment.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/profiles/${comment.author.username}`}
                      className="text-sm font-semibold text-slate-900 transition hover:text-slate-700"
                    >
                      {comment.author.name}
                    </Link>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{comment.content}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-500">
                    {new Date(comment.createdAt).toLocaleTimeString()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(comment.id);
                    setReplyDraft("");
                  }}
                  aria-label="Reply"
                  className="mt-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 17-5-5 5-5" />
                    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                  </svg>
                  <span className="sr-only">Reply</span>
                </button>

                {replyTo === comment.id ? (
                  <form onSubmit={onReply} className="mt-3 flex items-center gap-2">
                    <input
                      value={replyDraft}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      placeholder="Write a reply"
                      className="h-10 flex-1 rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={busy || !replyDraft.trim()}
                      aria-label="Post reply"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white disabled:opacity-60"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m22 2-7 20-4-9-9-4Z" />
                        <path d="M22 2 11 13" />
                      </svg>
                      <span className="sr-only">Post</span>
                    </button>
                  </form>
                ) : null}

                {replies.length > 0 ? (
                  <div className="mt-3 space-y-2 border-l border-slate-200 pl-3">
                    {replies.map((reply) => (
                      <div key={reply.id} className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-900">{reply.author.name}</p>
                        <p className="mt-1 text-sm text-slate-700">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          {rootComments.length === 0 ? (
            <p className="text-sm text-slate-500">No comments yet.</p>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
    </article>
  );
}
