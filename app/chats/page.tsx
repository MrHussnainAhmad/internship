import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";
import { ChatsClient } from "@/components/chats-client";
import { getDb } from "@/lib/db";

export default async function ChatsPage() {
  const user = await requireCurrentUser();
  if (!user.username || !user.role) {
    redirect("/onboarding");
  }

  const db = await getDb();
  await db.collection("notifications").updateMany(
    { userId: user._id, type: "chat_message", isRead: false },
    { $set: { isRead: true } }
  );

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-slate-900">Messages</h1>
        <p className="mt-1 text-sm text-slate-600">
          Real-time messaging with applicants and companies.
        </p>
      </div>

      <ChatsClient />
    </section>
  );
}