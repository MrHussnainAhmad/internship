"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { LiveChat } from "@/components/live-chat";

type ChatItem = {
  id: string;
  internship: {
    id: string;
    title: string;
    slug: string;
  };
  partner: {
    id: string;
    name: string;
    username: string;
    email: string;
  };
  updatedAt: string;
};

export function ChatNavPopup({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [badge, setBadge] = useState(initialUnread);

  useEffect(() => {
    if (!open) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/chats", { cache: "no-store" });
        const data = await response.json();
        if (!active) return;
        if (!response.ok) {
          setError(data.error ?? "Could not load chats");
          return;
        }
        const chats = Array.isArray(data.chats) ? (data.chats as ChatItem[]) : [];
        setItems(chats);
        setActiveChatId((prev) => {
          if (!prev && chats.length > 0) return chats[0].id;
          if (prev && chats.some((chat) => chat.id === prev)) return prev;
          return chats[0]?.id ?? "";
        });
        setError("");
      } catch {
        if (active) setError("Could not load chats");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !activeChatId) return;
    startTransition(async () => {
      await fetch("/api/notifications/read-chat", { method: "POST" });
      setBadge(0);
    });
  }, [open, activeChatId]);

  const active = items.find((item) => item.id === activeChatId);

  return (
    <div className="relative">
      <button
        type="button"
        title="Chats"
        aria-label="Chats"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        </svg>
        {badge > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-blue-700 px-1 text-[10px] font-semibold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,28rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Chats</p>
            <div className="flex items-center gap-2">
              {activeChatId ? (
                <Link
                  href={`/chats?chatId=${activeChatId}`}
                  title="<> Open in page"
                  aria-label="Open in page"
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => setOpen(false)}
                >
                  &lt;&gt;
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>

          {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
          {loading && items.length === 0 ? (
            <p className="mb-2 text-sm text-slate-600">Loading chats...</p>
          ) : null}

          {items.length > 0 ? (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveChatId(item.id)}
                  className={`shrink-0 rounded-md border px-3 py-1.5 text-xs ${
                    item.id === activeChatId
                      ? "border-blue-300 bg-blue-50 text-blue-900"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {item.partner.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No chats yet.</p>
          )}

          {active ? (
            <LiveChat chatId={active.id} title={`Chat with ${active.partner.name}`} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
