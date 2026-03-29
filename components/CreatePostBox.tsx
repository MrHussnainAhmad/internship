"use client";

import { FormEvent, startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function CreatePostBox() {
  const router = useRouter();
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

      // Only auto-hide when user has not typed anything.
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
        router.refresh();
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
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
        >
          Start a post
        </button>
      ) : (
        <form
          onSubmit={submit}
          className="space-y-3"
        >
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Topic (optional)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="What do you want to talk about?"
            className="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            maxLength={800}
            required
          />
          <div className="flex items-center justify-between">
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
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
