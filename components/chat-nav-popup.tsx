"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);
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
    setMounted(true);
  }, []);

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
    <div className="relative">
      <button
        type="button"
        title="Chats"
        aria-label="Chats"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        </svg>
        {badge > 0 ? (
          <span className="absolute right-0 top-0 inline-flex min-h-[18px] min-w-[18px] -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full border-2 border-white bg-slate-900 px-1 text-[10px] font-semibold leading-none text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>

      {open && mounted
        ? createPortal(
        <div className="fixed inset-x-4 bottom-4 top-auto z-[70] flex h-[min(64vh,560px)] w-auto flex-col overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:inset-x-auto sm:right-4 sm:w-[420px]">
          <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500" />
          <div className="flex items-center justify-between border-b border-blue-100 bg-gradient-to-b from-blue-50/80 to-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              {active ? (
                <button
                  type="button"
                  onClick={backToList}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-blue-700 transition hover:bg-blue-100 hover:text-blue-900"
                  title="Back"
                  aria-label="Back"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {active ? active.partner.name : "Messages"}
                </p>
                <p className="text-xs text-slate-600">
                  {active ? active.internship.title : "Recent conversations"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {active ? (
                <Link
                  href={`/chats?chatId=${active.id}`}
                  title="Open full chat"
                  aria-label="Open full chat"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-300 bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                  onClick={() => setOpen(false)}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 5h5v5" />
                    <path d="M10 14 19 5" />
                    <path d="M19 14v5h-5" />
                    <path d="M5 10 14 19" />
                  </svg>
                  <span className="sr-only">Open full chat</span>
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close chats"
                aria-label="Close chats"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m18 6-12 12" />
                  <path d="m6 6 12 12" />
                </svg>
                <span className="sr-only">Close chats</span>
              </button>
            </div>
          </div>

          {error ? <p className="border-b border-slate-200 px-4 py-2 text-sm text-red-600">{error}</p> : null}

          {!active ? (
            <div className="flex-1 overflow-auto bg-gradient-to-b from-slate-50/70 to-white p-2">
              {loading && items.length === 0 ? (
                <p className="px-2 py-3 text-sm text-slate-600">Loading chats...</p>
              ) : null}

              {items.length > 0 ? (
                <div className="space-y-1">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openChat(item.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        item.id === activeChatId
                          ? "border-blue-200 bg-blue-50 shadow-[0_1px_6px_rgba(37,99,235,0.12)]"
                          : "border-transparent hover:border-slate-200 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{item.partner.name}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-600">{item.internship.title}</p>
                        </div>
                        <p className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {timeAgo(item.updatedAt)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center">
                  <p className="text-sm text-slate-600">No chats yet.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-auto bg-gradient-to-b from-blue-50/40 to-slate-50/50 p-3">
              <LiveChat chatId={active.id} title={`Chat with ${active.partner.name}`} />
            </div>
          )}
        </div>
          ,
          document.body
        )
        : null}
    </div>
  );
}
