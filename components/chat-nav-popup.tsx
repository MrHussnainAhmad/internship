"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
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

function timeAgo(iso: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function ChatNavPopup({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [badge, setBadge] = useState(initialUnread);

  const active = useMemo(
    () => items.find((item) => item.id === activeChatId),
    [items, activeChatId]
  );

  useEffect(() => {
    if (!open) return;
    let activeState = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/chats", { cache: "no-store" });
        const data = await response.json();
        if (!activeState) return;
        if (!response.ok) {
          setError(data.error ?? "Could not load chats");
          return;
        }
        const chats = Array.isArray(data.chats) ? (data.chats as ChatItem[]) : [];
        setItems(chats);
        setActiveChatId((prev) => {
          if (!prev) return "";
          return chats.some((chat) => chat.id === prev) ? prev : "";
        });
        setError("");
      } catch {
        if (activeState) setError("Could not load chats");
      } finally {
        if (activeState) setLoading(false);
      }
    };

    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      activeState = false;
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

  const openChat = (chatId: string) => {
    setActiveChatId(chatId);
  };

  const backToList = () => {
    setActiveChatId("");
  };

  return (
    <div>
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
        <div className="fixed bottom-4 right-4 z-[70] w-[min(94vw,28rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {active ? (
                <button
                  type="button"
                  onClick={backToList}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                  title="Back"
                  aria-label="Back"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
              ) : null}
              <p className="text-sm font-semibold text-slate-900">
                {active ? active.partner.name : "Chats"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {active ? (
                <Link
                  href={`/chats?chatId=${active.id}`}
                  title="Open in page"
                  aria-label="Open in page"
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => setOpen(false)}
                >
                  Open
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

          {!active ? (
            <div className="max-h-[65vh] overflow-auto">
              {loading && items.length === 0 ? (
                <p className="mb-2 text-sm text-slate-600">Loading chats...</p>
              ) : null}
              {items.length > 0 ? (
                <div className="space-y-2">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openChat(item.id)}
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <p className="text-sm font-semibold text-slate-900">{item.partner.name}</p>
                      <p className="mt-0.5 text-xs text-slate-600">{item.internship.title}</p>
                      <p className="mt-1 text-[11px] text-slate-500">Updated {timeAgo(item.updatedAt)} ago</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">No chats yet.</p>
              )}
            </div>
          ) : (
            <div className="max-h-[65vh] overflow-auto">
              <LiveChat chatId={active.id} title={`Chat with ${active.partner.name}`} />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
