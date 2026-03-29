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
    "LinkedIn-style professional feed with posts, suggestions, and profile insights.",
};

function LandingPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <p className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            Internship-first platform
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Find internships by skill, not noise.
          </h1>
          <p className="max-w-xl text-lg text-slate-600">
            InternHub helps students discover focused opportunities and lets companies
            quickly find candidates by skills, level, and preferences.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/internships"
              className="rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Explore internships
            </Link>
            <Link
              href="/auth/signin"
              className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
            >
              Join with Google
            </Link>
          </div>
        </div>
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Smart search examples</h2>
          <ul className="space-y-3 text-sm text-slate-700">
            <li className="rounded-md bg-slate-50 px-3 py-2">&quot;unity internship&quot;</li>
            <li className="rounded-md bg-slate-50 px-3 py-2">&quot;unity internship lahore&quot;</li>
            <li className="rounded-md bg-slate-50 px-3 py-2">&quot;internship lahore&quot;</li>
          </ul>
          <p className="text-sm text-slate-600">
            Includes filters for city, country, level, type, and paid/unpaid with remote
            opportunities blended in.
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
            />
          </div>
        </main>

        <div className="hidden xl:block">
          <SidebarRight
            suggestions={sidebar.suggestions}
            showPostInternship={session.user.role === "company"}
          />
        </div>
      </div>
    </section>
  );
}
