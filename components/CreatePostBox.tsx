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
      className="overflow-hidden rounded-xl border border-[#D6DCE5] bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
    >
      {!open ? (
        <div className="p-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full items-center gap-3 rounded-lg border border-[#D6DCE5] bg-[#F8FAFC] px-4 py-3 text-left text-sm text-[#64748B] transition hover:border-[#B8C2D1] hover:bg-white"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#E2E8F0] text-sm font-semibold text-[#334155]">
              P
            </span>
            <span className="font-medium">Start a post</span>
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="border-b border-[#E2E8F0] px-5 py-4">
            <p className="text-base font-semibold text-[#0F172A]">Create a post</p>
            <p className="mt-1 text-xs text-[#64748B]">Share an update with your network</p>
          </div>

          <div className="space-y-4 px-5 py-5">
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Add a topic"
              className="h-11 w-full rounded-lg border border-[#D6DCE5] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#64748B] focus:border-[#93C5FD] focus:outline-none"
            />

            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="What do you want to talk about?"
              className="min-h-36 w-full rounded-lg border border-[#D6DCE5] bg-white px-3 py-3 text-sm leading-6 text-[#0F172A] placeholder:text-[#64748B] focus:border-[#93C5FD] focus:outline-none"
              maxLength={800}
              required
            />
          </div>

          <div className="flex items-center justify-between border-t border-[#E2E8F0] px-5 py-4">
            {error ? <p className="text-xs text-[#DC2626]">{error}</p> : <span />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTopic("");
                  setContent("");
                  setError("");
                }}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[#D6DCE5] px-4 text-sm font-medium text-[#475569] transition hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2563EB] px-5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-60"
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