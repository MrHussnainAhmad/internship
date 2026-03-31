"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  senderRole: string;
  createdAt: string;
};

type LiveChatProps = {
  chatId: string;
  title?: string;
};

export function LiveChat({ chatId, title }: LiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(`/api/chats/${chatId}/messages`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!active) return;
        if (!response.ok) {
          setError(data.error ?? "Could not load chat");
          return;
        }
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setCurrentUserId(String(data.currentUserId ?? ""));
        setError("");
      } catch {
        if (active) setError("Could not load chat");
      } finally {
        if (active) setLoading(false);
      }
    };

    setMessages([]);
    setCurrentUserId("");
    setLoading(true);
    void fetch("/api/notifications/read-chat", { method: "POST" });
    void load();
    const timer = setInterval(() => {
      void load();
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [chatId]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not send message");
        return;
      }
      setDraft("");
      const refresh = await fetch(`/api/chats/${chatId}/messages`, {
        cache: "no-store",
      });
      const refreshData = await refresh.json();
      if (refresh.ok) {
        setMessages(Array.isArray(refreshData.messages) ? refreshData.messages : []);
        setCurrentUserId(String(refreshData.currentUserId ?? ""));
      }
    } catch {
      setError("Could not send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{title ?? "Live chat"}</h3>
      </div>

      <div
        ref={listRef}
        className="min-h-[18rem] max-h-[30rem] space-y-3 overflow-y-auto bg-slate-50/50 p-4"
      >
        {loading ? <p className="text-sm text-slate-500">Loading messages...</p> : null}

        {!loading && messages.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet. Start the conversation.</p>
        ) : null}

        {messages.map((message) => {
          const mine = message.senderId === currentUserId;

          return (
            <div
              key={message.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
                  mine
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap leading-6">{message.text}</p>
                <p className={`mt-1 text-[11px] ${mine ? "text-slate-300" : "text-slate-500"}`}>
                  {new Date(message.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={sendMessage} className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type your message..."
            className="h-11 flex-1 rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />

          <button
            type="submit"
            title={sending ? "Sending" : "Send"}
            aria-label={sending ? "Sending" : "Send"}
            disabled={sending}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {sending ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" className="opacity-30" />
                <path d="M21 12a9 9 0 0 0-9-9" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            )}
            <span className="sr-only">{sending ? "Sending" : "Send"}</span>
          </button>
        </div>

        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </form>
    </div>
  );
}