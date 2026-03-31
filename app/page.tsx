import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryHomeFeed } from "@/lib/feed";
import { getHomeSidebarData } from "@/lib/home-sidebar";
import { SidebarLeft } from "@/components/SidebarLeft";
import { Feed } from "@/components/Feed";
import { SidebarRight } from "@/components/SidebarRight";
import { CreatePostBox } from "@/components/CreatePostBox";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Home Feed",
  description:
    "Action-driven internship feed with high-match opportunities, applications, and profile progress.",
};

function LandingPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <p className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-700">
            Internship-first platform
          </p>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-5xl">
            Find internships by skill, not noise.
          </h1>

          <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            InternHub helps students discover focused opportunities and lets companies
            find candidates by skills, level, and preferences.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/internships"
              className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Explore internships
            </Link>
            <Link
              href="/auth/signin"
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              Join with Google
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-slate-900">Smart search examples</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              &quot;unity internship&quot;
            </li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              &quot;unity internship lahore&quot;
            </li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              &quot;internship lahore&quot;
            </li>
          </ul>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Includes filters for city, country, level, type, and paid or unpaid opportunities.
          </p>
        </div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) return <LandingPage />;

  if (!session.user.username || !session.user.role || !session.user.id) {
    redirect("/onboarding");
  }

  const feed = await queryHomeFeed({
    viewerId: session.user.id,
    viewerRole: session.user.role,
    page: 1,
    limit: 10,
  });
  const sidebar = await getHomeSidebarData({
    viewerId: session.user.id,
    viewerRole: session.user.role,
  });

  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 py-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,680px)_300px]">
        <SidebarLeft profile={sidebar.currentProfile} />

        <main className="w-full max-w-[680px]">
          <div className="space-y-4">
            <CreatePostBox />
            <Feed
              initialItems={feed.items}
              initialHasMore={feed.hasMore}
              initialPage={feed.page}
              viewerRole={session.user.role}
            />
          </div>
        </main>

        <div className="hidden xl:block">
          <SidebarRight
            opportunities={sidebar.opportunities}
            peopleLikeYou={sidebar.peopleLikeYou}
            showPostInternship={session.user.role === "company"}
            viewerRole={session.user.role}
          />
        </div>
      </div>
    </section>
  );
}