"use client";

import { useEffect, useState } from "react";
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

  const active = items.find((item) => item.id === activeChatId);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
      <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Conversations</h2>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No chats yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveChatId(item.id)}
                className={`w-full rounded-md border px-3 py-2 text-left ${
                  item.id === activeChatId
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{item.partner.name}</p>
                <p className="text-xs text-slate-600">{item.internship.title}</p>
              </button>
            ))}
          </div>
        )}
      </aside>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {active ? (
          <>
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{active.partner.name}</h3>
                <p className="text-sm text-slate-600">{active.partner.email}</p>
              </div>
              <Link
                href={`/internships/${active.internship.slug}`}
                className="text-sm font-semibold text-blue-700 hover:text-blue-900"
              >
                Open internship
              </Link>
            </div>
            <LiveChat chatId={active.id} title={`Chat about ${active.internship.title}`} />
          </>
        ) : (
          <p className="text-sm text-slate-600">Select a chat to start messaging.</p>
        )}
      </section>
    </div>
  );
}
