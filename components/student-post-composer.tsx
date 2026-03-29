"use client";

import { FormEvent, startTransition, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  onPosted?: () => void;
};

export function StudentPostComposer({ onPosted }: Props) {
  const router = useRouter();
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
        router.refresh();
      } catch {
        setMessage("Could not publish post");
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Share a post</h3>
      <p className="mt-1 text-sm text-slate-600">
        Share certificates, learning progress, and achievements (text-only).
      </p>
      <div className="mt-3 space-y-3">
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Topic (e.g. React certificate)"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write your update..."
          className="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          required
          maxLength={800}
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        {message ? <p className="text-sm text-slate-600">{message}</p> : <span />}
        <button
          type="submit"
          title={busy ? "Posting" : "Post"}
          aria-label={busy ? "Posting" : "Post"}
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}
