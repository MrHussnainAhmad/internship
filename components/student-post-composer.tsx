"use client";

import { FormEvent, startTransition, useState } from "react";
import { dispatchFeedPrependPost } from "@/lib/feed-events";

type Props = {
  onPosted?: () => void;
};

export function StudentPostComposer({ onPosted }: Props) {
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, content }),
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error ?? "Could not publish post");
          return;
        }
        setTopic("");
        setContent("");
        setMessage("Post published.");
        onPosted?.();
        if (data.feedItem) {
          dispatchFeedPrependPost({ post: data.feedItem });
        }
      } catch {
        setMessage("Could not publish post");
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
    >
      <div className="border-b border-slate-200 pb-4">
        <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-slate-900">Share a post</h3>
        <p className="mt-1 text-sm text-slate-600">
          Share certificates, learning progress, and achievements.
        </p>
      </div>

      <div className="mt-4 space-y-4">
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Topic"
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write your update..."
          className="min-h-32 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          required
          maxLength={800}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        {message ? <p className="text-sm text-slate-600">{message}</p> : <span />}
        <button
          type="submit"
          title={busy ? "Posting" : "Post"}
          aria-label={busy ? "Posting" : "Post"}
          disabled={busy}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" className="opacity-30" />
              <path d="M21 12a9 9 0 0 0-9-9" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          )}
          <span className="sr-only">{busy ? "Posting..." : "Post"}</span>
        </button>
      </div>
    </form>
  );
}
