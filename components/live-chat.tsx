"use client";

import { FormEvent, useEffect, useState } from "react";

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
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{title ?? "Live chat"}</h3>
      </div>
      <div className="min-h-[18rem] max-h-[30rem] space-y-2 overflow-y-auto p-4">
        {loading ? <p className="text-sm text-slate-500">Loading messages...</p> : null}
        {!loading && messages.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet. Start the conversation.</p>
        ) : null}
        {messages.map((message) => {
          const mine = message.senderId === currentUserId;
          return (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${
                mine
                  ? "ml-auto bg-slate-900 text-white"
                  : "mr-auto bg-slate-100 text-slate-800"
              }`}
            >
              <p>{message.text}</p>
              <p className={`mt-1 text-[11px] ${mine ? "text-slate-300" : "text-slate-500"}`}>
                {new Date(message.createdAt).toLocaleTimeString()}
              </p>
            </div>
          );
        })}
      </div>

      <form onSubmit={sendMessage} className="border-t border-slate-200 p-3">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            title={sending ? "Sending" : "Send"}
            aria-label={sending ? "Sending" : "Send"}
            disabled={sending}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white disabled:opacity-60"
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
