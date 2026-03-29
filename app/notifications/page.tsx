import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { NotificationsClient } from "@/components/notifications-client";

export default async function NotificationsPage() {
  const user = await requireCurrentUser();
  if (!user.username || !user.role) {
    redirect("/onboarding");
  }

  const db = await getDb();
  const rows = await db
    .collection("notifications")
    .find({ userId: user._id, type: { $ne: "chat_message" } })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  const unreadCount = await db
    .collection("notifications")
    .countDocuments({ userId: user._id, isRead: false, type: { $ne: "chat_message" } });

  const items = rows.map((item) => ({
    id: item._id.toString(),
    title: String(item.title ?? ""),
    body: String(item.body ?? ""),
    link: String(item.link ?? ""),
    isRead: Boolean(item.isRead),
    createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : "",
  }));

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Notifications</h1>
      <p className="mb-6 text-sm text-slate-600">
        Mandatory alerts for applications, messages, and decisions.
      </p>
      <NotificationsClient initialItems={items} initialUnreadCount={unreadCount} />
    </section>
  );
}
