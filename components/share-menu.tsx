"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { dispatchFeedPrependPost } from "@/lib/feed-events";
import { toAbsoluteUrl } from "@/lib/site-url";

type RepostTarget =
  | { kind: "post"; postId: string }
  | { kind: "internship"; internshipSlug: string };

type ShareMenuProps = {
  sharePath: string;
  title: string;
  description?: string;
  repostTarget?: RepostTarget;
  onTrackShare?: () => Promise<void> | void;
  onError?: (message: string) => void;
};

function RepostIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 1v4H7" />
      <path d="m3 5 4-4 4 4" />
      <path d="M7 23v-4h10" />
      <path d="m21 19-4 4-4-4" />
    </svg>
  );
}

function WhatsappIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M17.5 14.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.2-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.7.3-.2.3-1 1-.9 2.4 0 1.4 1 2.8 1.2 2.9.2.2 2 3.2 4.9 4.4 2.8 1.2 2.8.8 3.3.8s1.7-.7 1.9-1.3c.2-.6.2-1.2.1-1.3 0-.2-.2-.2-.5-.4Z" />
      <path d="M20.5 3.5A11.4 11.4 0 0 0 2.6 17.2L1 23l6-1.5a11.4 11.4 0 0 0 5 1.1h.1a11.4 11.4 0 0 0 8.4-19Zm-8.4 17.2a9.6 9.6 0 0 1-4.8-1.3l-.4-.2-3.5.9.9-3.4-.2-.4a9.5 9.5 0 1 1 8 4.4Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0-.02-5ZM3 9h4v12H3zM10 9h3.8v1.7h.1c.5-.9 1.8-1.9 3.7-1.9 4 0 4.7 2.6 4.7 6V21h-4v-5.5c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21h-4z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.9-6.5L6.2 22H3l7.3-8.4L1 2h6.4l4.4 5.9L18.9 2Zm-1.1 18h1.7L6.5 3.8H4.7L17.8 20Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.1 0l2.8-2.8a5 5 0 0 0-7.1-7.1L10 5" />
      <path d="M14 11a5 5 0 0 0-7.1 0l-2.8 2.8a5 5 0 0 0 7.1 7.1L14 19" />
    </svg>
  );
}

export function ShareMenu({
  sharePath,
  title,
  description = "",
  repostTarget,
  onTrackShare,
  onError,
}: ShareMenuProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const shareUrl = useMemo(() => {
    const browserOrigin =
      typeof window !== "undefined" ? window.location.origin : undefined;
    return toAbsoluteUrl(sharePath, browserOrigin);
  }, [sharePath]);

  useEffect(() => {
    if (!menuOpen) return;

    const onOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current && !wrapperRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onOutsideClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen]);

  const trackShare = async () => {
    if (!onTrackShare) return;
    await onTrackShare();
  };

  const openPopup = (url: string) => {
    if (typeof window === "undefined") return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareText = description.trim() ? `${title} - ${description}` : title;

  const shareToWhatsApp = async () => {
    setMenuOpen(false);
    setFeedback("");
    try {
      const url = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
      openPopup(url);
      await trackShare();
      setFeedback("Ready to share on WhatsApp.");
    } catch {
      onError?.("Could not share on WhatsApp");
    }
  };

  const shareToLinkedIn = async () => {
    setMenuOpen(false);
    setFeedback("");
    try {
      const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
      openPopup(url);
      await trackShare();
      setFeedback("Ready to share on LinkedIn.");
    } catch {
      onError?.("Could not share on LinkedIn");
    }
  };

  const shareToX = async () => {
    setMenuOpen(false);
    setFeedback("");
    try {
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
      openPopup(url);
      await trackShare();
      setFeedback("Ready to share on X.");
    } catch {
      onError?.("Could not share on X");
    }
  };

  const copyLink = async () => {
    setMenuOpen(false);
    setFeedback("");
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(shareUrl);
      await trackShare();
      setFeedback("Link copied.");
    } catch {
      onError?.("Could not copy link");
    }
  };

  const submitRepost = async (event: FormEvent) => {
    event.preventDefault();
    if (!repostTarget || busy) return;

    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/api/posts/repost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...repostTarget,
          caption,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        onError?.(data.error ?? "Could not repost");
        return;
      }
      setCaption("");
      setRepostOpen(false);
      setMenuOpen(false);
      setFeedback("Reposted to your profile.");
      if (data.feedItem) {
        dispatchFeedPrependPost({ post: data.feedItem });
      }
      await trackShare();
    } catch {
      onError?.("Could not repost");
    } finally {
      setBusy(false);
    }
  };

  const actionClass =
    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((value) => !value)}
        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-200"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
          <path d="M12 16V3" />
          <path d="m7 8 5-5 5 5" />
        </svg>
        Share
      </button>

      {menuOpen ? (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Share this
          </p>

          {repostTarget ? (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setRepostOpen(true);
              }}
              className={actionClass}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <RepostIcon />
              </span>
              Repost
            </button>
          ) : null}

          <button
            type="button"
            onClick={shareToWhatsApp}
            className={actionClass}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <WhatsappIcon />
            </span>
            Share via WhatsApp
          </button>

          <button
            type="button"
            onClick={shareToLinkedIn}
            className={actionClass}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <LinkedInIcon />
            </span>
            Share via LinkedIn
          </button>

          <button
            type="button"
            onClick={shareToX}
            className={actionClass}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-900">
              <XIcon />
            </span>
            Share via X
          </button>

          <button
            type="button"
            onClick={copyLink}
            className={actionClass}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <LinkIcon />
            </span>
            Copy link
          </button>
        </div>
      ) : null}

      {repostOpen ? (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setRepostOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">Repost to your feed</h3>
              <button
                type="button"
                onClick={() => setRepostOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <form onSubmit={submitRepost} className="space-y-3">
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Add a caption (optional)"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{caption.length}/500</p>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? "Reposting..." : "Repost"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {feedback ? <p className="mt-2 text-xs text-emerald-700">{feedback}</p> : null}
    </div>
  );
}
