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
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#475569] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
    >
      {children}
      {badge && badge > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-md bg-[#2563EB] px-1 text-[10px] font-semibold leading-none text-white">
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
      <div className="flex w-full max-w-2xl items-center overflow-hidden rounded-xl border border-[#D6DCE5] bg-[#F8FAFC] transition focus-within:border-[#93C5FD] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.10)]">
        <div className="flex items-center pl-4">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-[#64748B]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </div>

        <input
          name="q"
          placeholder="Search internships, skills, companies"
          required
          className="h-11 w-full bg-transparent px-3 text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none"
        />

        <div className="h-5 w-px bg-[#D6DCE5]" />

        <select
          name="type"
          defaultValue=""
          className="h-11 bg-transparent px-3 text-xs font-semibold text-[#475569] focus:outline-none"
        >
          <option value="">All types</option>
          <option value="paid">Paid</option>
          <option value="learn_and_earn">Learn and Earn</option>
          <option value="unpaid">Unpaid</option>
        </select>

        <button
          type="submit"
          className="mr-1.5 inline-flex h-8 items-center justify-center rounded-md bg-[#2563EB] px-3 text-xs font-semibold text-white transition hover:bg-[#1D4ED8]"
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
    <header className="sticky top-0 z-40 border-b border-[#D6DCE5] bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1280px] items-center gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 text-[20px] font-semibold tracking-[-0.03em] text-[#0F172A]">
          InternHub
        </Link>

        <InternshipSearchBar />

        <nav className="ml-auto flex items-center gap-1 text-sm">
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
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}