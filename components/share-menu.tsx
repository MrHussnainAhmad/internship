"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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

function ActionIcon({ children }: { children: string }) {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
      {children}
    </span>
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
      await trackShare();
    } catch {
      onError?.("Could not repost");
    } finally {
      setBusy(false);
    }
  };

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
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              <ActionIcon>RP</ActionIcon>
              Repost
            </button>
          ) : null}

          <button
            type="button"
            onClick={shareToWhatsApp}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            <ActionIcon>WA</ActionIcon>
            Share via WhatsApp
          </button>

          <button
            type="button"
            onClick={shareToLinkedIn}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            <ActionIcon>in</ActionIcon>
            Share via LinkedIn
          </button>

          <button
            type="button"
            onClick={shareToX}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            <ActionIcon>X</ActionIcon>
            Share via X
          </button>

          <button
            type="button"
            onClick={copyLink}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            <ActionIcon>CP</ActionIcon>
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
