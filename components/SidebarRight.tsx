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
        <section className="px-1 py-2">
          <Link
            href="/internships/new"
            className="inline-flex w-full items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Post new internship
          </Link>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Opportunities for you</h2>
        {opportunities.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No high-match opportunities yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {opportunities.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/internships/${item.slug}`}
                      className="text-sm font-semibold text-slate-900 hover:text-blue-700"
                    >
                      {item.title}
                    </Link>
                    <div className="flex items-center gap-1">
                      <p className="text-xs text-slate-600">{item.companyName}</p>
                      {item.companyVerified ? <VerifiedBadge trustedLabel={false} /> : null}
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                    {item.matchPercent}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {item.location}, {item.country}
                  {item.isRemote ? " • Remote" : ""}
                  {` • ${timeAgo(item.createdAt)}`}
                </p>
                <p className="mt-1 text-xs text-slate-700">
                  Matched: {item.matchedSkills.slice(0, 3).join(", ")}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Link
                    href={`/internships/${item.slug}`}
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
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

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">People like you</h2>
        {peopleLikeYou.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No similar profiles right now.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {peopleLikeYou.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
                      {item.name ? item.name.charAt(0).toUpperCase() : "?"}
                    </span>
                  )}
                  <div>
                    <Link
                      href={`/profiles/${item.username}`}
                      className="text-sm font-semibold text-slate-900 hover:text-blue-700"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-slate-600">{item.headline || item.role}</p>
                    {item.sharedSkills.length > 0 ? (
                      <p className="text-xs text-blue-700">
                        Shared: {item.sharedSkills.join(", ")}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => follow(item.id)}
                  disabled={busyId === item.id}
                  className="rounded-full border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700 disabled:opacity-60"
                >
                  {busyId === item.id ? "..." : "Follow"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}

