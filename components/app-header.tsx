import Link from "next/link";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AccountMenu } from "@/components/account-menu";
import { ChatNavPopup } from "@/components/chat-nav-popup";

function IconLink({
  href,
  label,
  badge,
  children,
}: {
  href: string;
  label: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
      {badge && badge > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-blue-700 px-1 text-[10px] font-semibold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

function InternshipSearchBar() {
  return (
    <form
      action="/internships"
      method="get"
      className="hidden flex-1 items-center justify-center px-4 md:flex"
      role="search"
    >
      <div className="flex w-full max-w-xl items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-slate-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          name="q"
          placeholder="Search internships by title, skill, location"
          required
          className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none"
        />
        <select
          name="type"
          defaultValue=""
          className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none"
        >
          <option value="">Any type</option>
          <option value="paid">Paid</option>
          <option value="learn_and_earn">Learn and Earn</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <button
          type="submit"
          className="rounded-full bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
        >
          Search
        </button>
      </div>
    </form>
  );
}

export async function AppHeader() {
  const session = await auth();
  const user = session?.user;
  const role = user?.role;

  let unreadAlerts = 0;
  let unreadChats = 0;

  if (user?.email) {
    const db = await getDb();
    const dbUser = await db
      .collection("users")
      .findOne({ email: user.email }, { projection: { _id: 1 } });
    if (dbUser) {
      unreadChats = await db.collection("notifications").countDocuments({
        userId: dbUser._id,
        isRead: false,
        type: "chat_message",
      });
      unreadAlerts = await db.collection("notifications").countDocuments({
        userId: dbUser._id,
        isRead: false,
        type: { $ne: "chat_message" },
      });
    }
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
          InternHub
        </Link>
        <InternshipSearchBar />
        <nav className="ml-auto flex items-center gap-2 text-sm text-slate-700">
          {user ? (
            <>
              {role === "student" ? (
                <IconLink href="/internships" label="Internships">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="7" width="18" height="13" rx="2" />
                    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </IconLink>
              ) : null}
              <ChatNavPopup initialUnread={unreadChats} />
              <IconLink href="/notifications" label="Notifications" badge={unreadAlerts}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V10a6 6 0 0 0-12 0v4.2a2 2 0 0 1-.6 1.4L4 17h5" />
                  <path d="M9 17a3 3 0 0 0 6 0" />
                </svg>
              </IconLink>
              <IconLink href="/dashboard" label="Dashboard">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 13h8V3H3zM13 21h8v-6h-8zM13 11h8V3h-8zM3 21h8v-6H3z" />
                </svg>
              </IconLink>
              <AccountMenu />
            </>
          ) : (
            <Link
              href="/auth/signin"
              className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-700"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
