"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useState } from "react";
import { ApplyButton } from "@/components/apply-button";
import { VerifiedBadge } from "@/components/verified-badge";

type SimilarUser = {
  id: string;
  name: string;
  username: string;
  role: string;
  image: string;
  headline: string;
  sharedSkills: string[];
};

type OpportunityItem = {
  id: string;
  slug: string;
  title: string;
  companyName: string;
  companyVerified?: boolean;
  location: string;
  country: string;
  isRemote: boolean;
  matchPercent: number;
  matchedSkills: string[];
  createdAt: string;
};

function timeAgo(iso: string) {
  const deltaSeconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SidebarRight({
  opportunities,
  peopleLikeYou: initialPeople,
  showPostInternship,
  viewerRole,
}: {
  opportunities: OpportunityItem[];
  peopleLikeYou: SimilarUser[];
  showPostInternship?: boolean;
  viewerRole: "student" | "company";
}) {
  const [peopleLikeYou, setPeopleLikeYou] = useState(initialPeople);
  const [busyId, setBusyId] = useState("");

  const follow = (userId: string) => {
    if (busyId) return;
    setBusyId(userId);
    startTransition(async () => {
      try {
        const response = await fetch("/api/connections/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: userId }),
        });
        const data = await response.json();
        if (!response.ok || !data.connected) return;
        setPeopleLikeYou((prev) => prev.filter((item) => item.id !== userId));
      } finally {
        setBusyId("");
      }
    });
  };

  return (
    <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
      {showPostInternship ? (
        <section className="px-1 py-1">
          <Link
            href="/internships/new"
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Post new internship
          </Link>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <h2 className="text-sm font-semibold text-slate-900">Opportunities for you</h2>

        {opportunities.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No high-match opportunities yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {opportunities.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/internships/${item.slug}`}
                      className="text-sm font-semibold text-slate-900 transition hover:text-slate-700"
                    >
                      {item.title}
                    </Link>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <p className="text-xs text-slate-600">{item.companyName}</p>
                      {item.companyVerified ? <VerifiedBadge trustedLabel={false} /> : null}
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {item.matchPercent}%
                  </span>
                </div>

                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {item.location}, {item.country}
                  {item.isRemote ? " · Remote" : ""}
                  {` · ${timeAgo(item.createdAt)}`}
                </p>

                <p className="mt-2 text-xs text-slate-700">
                  Matched: {item.matchedSkills.slice(0, 3).join(", ")}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/internships/${item.slug}`}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    View
                  </Link>
                  {viewerRole === "student" ? <ApplyButton internshipSlug={item.slug} /> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <h2 className="text-sm font-semibold text-slate-900">People like you</h2>

        {peopleLikeYou.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No similar profiles right now.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {peopleLikeYou.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={42}
                      height={42}
                      className="h-[42px] w-[42px] rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <span className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
                      {item.name ? item.name.charAt(0).toUpperCase() : "?"}
                    </span>
                  )}

                  <div className="min-w-0">
                    <Link
                      href={`/profiles/${item.username}`}
                      className="truncate text-sm font-semibold text-slate-900 transition hover:text-slate-700"
                    >
                      {item.name}
                    </Link>
                    <p className="truncate text-xs text-slate-600">{item.headline || item.role}</p>
                    {item.sharedSkills.length > 0 ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Shared: {item.sharedSkills.join(", ")}
                      </p>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => follow(item.id)}
                  disabled={busyId === item.id}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {busyId === item.id ? "Following..." : "Follow"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}