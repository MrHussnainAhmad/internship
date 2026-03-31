"use client";

import { FormEvent, startTransition, useEffect, useRef, useState } from "react";
import { dispatchFeedPrependPost } from "@/lib/feed-events";

export function CreatePostBox() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;

      if (!topic.trim() && !content.trim()) {
        setOpen(false);
        setTopic("");
        setContent("");
        setError("");
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, topic, content]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || !content.trim()) return;

    setBusy(true);
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, content }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Could not publish post");
          return;
        }
        setTopic("");
        setContent("");
        setOpen(false);
        if (data.feedItem) {
          dispatchFeedPrependPost({ post: data.feedItem });
        }
      } catch {
        setError("Could not publish post");
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <section
      ref={containerRef}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
    >
      {!open ? (
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
            P
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-11 w-full rounded-full border border-slate-300 bg-white px-4 text-left text-sm text-slate-500 transition hover:bg-slate-50"
          >
            Start a post
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <p className="text-sm font-semibold text-slate-900">Create a post</p>
            <p className="mt-1 text-xs text-slate-500">Share an update with your network</p>
          </div>

          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Topic"
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="What do you want to talk about?"
            className="min-h-32 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            maxLength={800}
            required
          />

          <div className="flex items-center justify-between gap-3">
            {error ? <p className="text-xs text-red-600">{error}</p> : <span />}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTopic("");
                  setContent("");
                  setError("");
                }}
                className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-10 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}