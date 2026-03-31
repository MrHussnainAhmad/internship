"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ChatsClient() {
  const searchParams = useSearchParams();
  const requestedChatId = searchParams.get("chatId") ?? "";
  const [items, setItems] = useState<ChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
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
        setError("");
        setActiveChatId((prev) => {
          if (requestedChatId && chats.some((chat) => chat.id === requestedChatId)) {
            return requestedChatId;
          }
          if (!prev && chats.length > 0) return chats[0].id;
          if (prev && !chats.some((chat) => chat.id === prev)) return chats[0]?.id ?? "";
          return prev;
        });
      } catch {
        if (active) setError("Could not load chats");
      }
    };

    void load();
    const timer = setInterval(() => {
      void load();
    }, 5000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [requestedChatId]);

  const active = useMemo(
    () => items.find((item) => item.id === activeChatId),
    [items, activeChatId]
  );

  const showMobileList = !active;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <div className="grid min-h-[72vh] grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={`${showMobileList ? "block" : "hidden"} border-r border-slate-200 bg-white lg:block`}>
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-slate-900">Messages</h2>
            <p className="mt-1 text-xs text-slate-500">Your recent conversations</p>
            {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          </div>

          <div className="max-h-[calc(72vh-73px)] overflow-y-auto p-2">
            {items.length === 0 ? (
              <div className="m-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                No chats yet.
              </div>
            ) : (
              <div className="space-y-1">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveChatId(item.id)}
                    className={`w-full rounded-xl px-4 py-3 text-left transition ${
                      item.id === activeChatId
                        ? "bg-slate-100"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.partner.name}</p>
                      <p className="shrink-0 text-[11px] text-slate-500">{timeAgo(item.updatedAt)}</p>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-600">{item.internship.title}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className={`${showMobileList ? "hidden" : "block"} bg-white lg:block`}>
          {active ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveChatId("")}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
                    title="Back"
                    aria-label="Back"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>

                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-900">{active.partner.name}</h3>
                    <p className="truncate text-xs text-slate-500">{active.partner.email}</p>
                  </div>
                </div>

                <Link
                  href={`/internships/${active.internship.slug}`}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Internship
                </Link>
              </div>

              <div className="bg-slate-50/40 p-4">
                <LiveChat chatId={active.id} title={`Chat about ${active.internship.title}`} />
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[72vh] items-center justify-center p-6 text-center">
              <div>
                <p className="text-base font-semibold text-slate-900">Select a conversation</p>
                <p className="mt-1 text-sm text-slate-600">Choose a chat from the list to start messaging.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}