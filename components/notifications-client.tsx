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
      router.refresh();
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
        } else {
          router.refresh();
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-slate-900">Alerts</h2>
          <p className="mt-1 text-sm text-slate-600">Unread alerts: {unreadCount}</p>
        </div>

        <button
          type="button"
          onClick={markAllRead}
          disabled={busy || unreadCount === 0}
          title="Mark all notifications read"
          aria-label="Mark all notifications read"
          className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          Mark all read
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {items.length === 0 ? (
        <p className="mt-5 text-sm text-slate-600">No alerts yet.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border p-4 transition ${
                item.isRead
                  ? "border-slate-200 bg-white"
                  : "border-slate-300 bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{item.body}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>

                {!item.isRead ? (
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-900" />
                ) : null}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                {!item.isRead ? (
                  <button
                    type="button"
                    onClick={() => void markOneRead(item.id)}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    title="Mark read"
                    aria-label="Mark read"
                  >
                    Mark read
                  </button>
                ) : null}

                {item.link ? (
                  <button
                    type="button"
                    onClick={() => openNotification(item)}
                    className="inline-flex h-9 items-center justify-center rounded-full bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    Open
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}