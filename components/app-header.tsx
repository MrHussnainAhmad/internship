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
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
      {badge && badge > 0 ? (
        <span className="absolute right-0 top-0 inline-flex min-h-[18px] min-w-[18px] -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full border-2 border-white bg-slate-900 px-1 text-[10px] font-semibold leading-none text-white">
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
      className="hidden flex-1 items-center justify-center px-6 lg:flex"
      role="search"
    >
      <div className="flex w-full max-w-2xl items-center rounded-full border border-slate-300 bg-slate-50 pl-4 pr-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition focus-within:border-slate-400 focus-within:bg-white">
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
          placeholder="Search internships, skills, or location"
          required
          className="h-11 w-full bg-transparent px-3 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
        />

        <div className="mx-2 h-5 w-px bg-slate-300" />

        <select
          name="type"
          defaultValue=""
          className="h-9 rounded-full bg-transparent px-3 text-xs font-medium text-slate-700 focus:outline-none"
        >
          <option value="">All types</option>
          <option value="paid">Paid</option>
          <option value="learn_and_earn">Learn and Earn</option>
          <option value="unpaid">Unpaid</option>
        </select>

        <button
          type="submit"
          className="ml-2 inline-flex h-9 items-center justify-center rounded-full bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-800"
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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 text-[19px] font-semibold tracking-[-0.02em] text-slate-900">
          InternHub
        </Link>

        <InternshipSearchBar />

        <nav className="ml-auto flex items-center gap-1 text-sm text-slate-700">
          {user ? (
            <>
              {role === "student" ? (
                <IconLink href="/internships" label="Internships">
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <rect x="3" y="7" width="18" height="13" rx="2" />
                    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </IconLink>
              ) : null}

              <ChatNavPopup initialUnread={unreadChats} />

              <IconLink href="/notifications" label="Notifications" badge={unreadAlerts}>
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V10a6 6 0 0 0-12 0v4.2a2 2 0 0 1-.6 1.4L4 17h5" />
                  <path d="M9 17a3 3 0 0 0 6 0" />
                </svg>
              </IconLink>

              <IconLink href="/dashboard" label="Dashboard">
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M3 13h8V3H3zM13 21h8v-6h-8zM13 11h8V3h-8zM3 21h8v-6H3z" />
                </svg>
              </IconLink>

              <div className="ml-1">
                <AccountMenu />
              </div>
            </>
          ) : (
            <Link
              href="/auth/signin"
              className="inline-flex h-10 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}