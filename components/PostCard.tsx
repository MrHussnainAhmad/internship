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
        className="h-11 w-11 rounded-lg border border-[#D6DCE5] object-cover"
      />
    );
  }
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#D6DCE5] bg-[#E2E8F0] text-sm font-semibold text-[#334155]">
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
    <article className="overflow-hidden rounded-xl border border-[#D6DCE5] bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      {item.repost?.sourcePath ? (
        <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3 text-xs text-[#64748B]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#334155]">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 1v4H7" />
              <path d="m3 5 4-4 4 4" />
              <path d="M7 23v-4h10" />
              <path d="m21 19-4 4-4-4" />
            </svg>
            Reposted
          </span>
          <Link href={item.repost.sourcePath} className="font-medium text-[#2563EB] hover:text-[#1D4ED8]">
            {repostSourceLabel}
          </Link>
        </div>
      ) : null}

      <div className="px-5 py-4">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={item.author.name} image={item.author.image} />
            <div className="min-w-0">
              <Link
                href={`/profiles/${item.author.username}`}
                className="truncate text-sm font-semibold text-[#0F172A] transition hover:text-[#2563EB]"
              >
                {item.author.name}
              </Link>
              <p className="text-xs text-[#64748B]">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {item.author.canFollow && !isFollowing ? (
            <button
              type="button"
              onClick={onFollow}
              disabled={followBusy}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#D6DCE5] px-4 text-xs font-semibold text-[#334155] transition hover:bg-[#F8FAFC] disabled:opacity-60"
            >
              {followBusy ? "Following..." : "Follow"}
            </button>
          ) : null}
        </header>

        {item.topic ? <p className="mt-4 text-[15px] font-semibold text-[#0F172A]">{item.topic}</p> : null}
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#334155]">{item.content}</p>

        <div className="mt-4 flex items-center gap-4 border-t border-[#E2E8F0] pt-4 text-xs text-[#64748B]">
          <span>{likesCount} likes</span>
          <span>{commentsCount} comments</span>
          <span>{shareCount} shares</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onLike}
            className={`inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium transition ${
              liked
                ? "bg-[#DBEAFE] text-[#1D4ED8]"
                : "bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9]"
            }`}
          >
            Like
          </button>

          <button
            type="button"
            onClick={onToggleComments}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#F8FAFC] px-3 text-sm text-[#475569] transition hover:bg-[#F1F5F9]"
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

        {!commentsOpen && previewComments.length > 0 ? (
          <section className="mt-4 space-y-2 border-t border-[#E2E8F0] pt-4">
            {previewComments.map((comment) => (
              <div key={comment.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3">
                <p className="text-xs font-semibold text-[#0F172A]">{comment.author.name}</p>
                <p className="mt-1 line-clamp-2 text-sm text-[#334155]">{comment.content}</p>
              </div>
            ))}
            <button
              type="button"
              onClick={onToggleComments}
              className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
            >
              View comments
            </button>
          </section>
        ) : null}

        {commentsOpen ? (
          <section className="mt-4 space-y-4 border-t border-[#E2E8F0] pt-4">
            <form onSubmit={onComment} className="flex items-center gap-2">
              <input
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="Write a comment"
                className="h-11 flex-1 rounded-lg border border-[#D6DCE5] bg-white px-4 text-sm text-[#0F172A] placeholder:text-[#64748B] focus:border-[#93C5FD] focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !commentDraft.trim()}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                Post
              </button>
            </form>

            {rootComments.map((comment) => {
              const replies = commentsByParent.get(comment.id) ?? [];
              return (
                <div key={comment.id} className="rounded-lg border border-[#E2E8F0] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/profiles/${comment.author.username}`}
                        className="text-sm font-semibold text-[#0F172A] transition hover:text-[#2563EB]"
                      >
                        {comment.author.name}
                      </Link>
                      <p className="mt-1 text-sm leading-6 text-[#334155]">{comment.content}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-[#64748B]">
                      {new Date(comment.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(comment.id);
                      setReplyDraft("");
                    }}
                    className="mt-2 text-xs font-semibold text-[#2563EB]"
                  >
                    Reply
                  </button>

                  {replyTo === comment.id ? (
                    <form onSubmit={onReply} className="mt-3 flex items-center gap-2">
                      <input
                        value={replyDraft}
                        onChange={(event) => setReplyDraft(event.target.value)}
                        placeholder="Write a reply"
                        className="h-10 flex-1 rounded-lg border border-[#D6DCE5] bg-white px-4 text-sm text-[#0F172A] placeholder:text-[#64748B] focus:border-[#93C5FD] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={busy || !replyDraft.trim()}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Post
                      </button>
                    </form>
                  ) : null}

                  {replies.length > 0 ? (
                    <div className="mt-3 space-y-2 border-l border-[#D6DCE5] pl-3">
                      {replies.map((reply) => (
                        <div key={reply.id} className="rounded-lg bg-[#F8FAFC] p-3">
                          <p className="text-xs font-semibold text-[#0F172A]">{reply.author.name}</p>
                          <p className="mt-1 text-sm text-[#334155]">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {rootComments.length === 0 ? (
              <p className="text-sm text-[#64748B]">No comments yet.</p>
            ) : null}
          </section>
        ) : null}

        {error ? <p className="mt-3 text-xs text-[#DC2626]">{error}</p> : null}
      </div>
    </article>
  );
}