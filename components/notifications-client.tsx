"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  createdAt: string;
};

export function NotificationsClient({
  initialItems,
  initialUnreadCount,
}: {
  initialItems: NotificationItem[];
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const markOneRead = async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (!current || current.isRead) return true;

    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
    setUnreadCount((value) => Math.max(0, value - 1));

    try {
      const response = await fetch("/api/notifications/read-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      if (!response.ok) {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, isRead: false } : item))
        );
        setUnreadCount((value) => value + 1);
        return false;
      }
      return true;
    } catch {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: false } : item))
      );
      setUnreadCount((value) => value + 1);
      return false;
    }
  };

  const markAllRead = () => {
    if (busy || unreadCount === 0) return;
    setBusy(true);
    setError("");

    const previous = items;
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);

    startTransition(async () => {
      try {
        const response = await fetch("/api/notifications/read-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "alerts" }),
        });
        if (!response.ok) {
          setItems(previous);
          setUnreadCount(previous.filter((item) => !item.isRead).length);
          setError("Could not mark all read");
        }
      } catch {
        setItems(previous);
        setUnreadCount(previous.filter((item) => !item.isRead).length);
        setError("Could not mark all read");
      } finally {
        setBusy(false);
      }
    });
  };

  const openNotification = (item: NotificationItem) => {
    startTransition(async () => {
      const ok = await markOneRead(item.id);
      if (!ok) {
        setError("Could not mark notification read");
      }
      if (item.link) {
        router.push(item.link);
      }
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Alerts</h2>
        <button
          type="button"
          onClick={markAllRead}
          disabled={busy || unreadCount === 0}
          title="Mark all notifications read"
          aria-label="Mark all notifications read"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 13l4 4L19 7" />
            <path d="M5 7l4 4" />
          </svg>
          <span className="sr-only">Mark all read</span>
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-600">Unread alerts: {unreadCount}</p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No alerts yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className={`rounded-lg border p-4 ${
                item.isRead ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"
              }`}
            >
              <p className="font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm text-slate-700">{item.body}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  {!item.isRead ? (
                    <button
                      type="button"
                      onClick={() => void markOneRead(item.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-700"
                      title="Mark read"
                      aria-label="Mark read"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  ) : null}
                  {item.link ? (
                    <button
                      type="button"
                      onClick={() => openNotification(item)}
                      className="text-xs font-semibold text-blue-700"
                    >
                      Open
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
