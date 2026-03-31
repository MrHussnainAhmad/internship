"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Props = {
  profile: {
    id: string;
    name: string;
    username: string;
    role: string;
    image: string;
    skills: string[];
    location: string;
    views: number;
  };
};

export function CurrentProfilePanel({ profile }: Props) {
  const [views, setViews] = useState(profile.views);

  useEffect(() => {
    let active = true;
    const POLL_MS = 30000;
    const loadViews = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      try {
        const response = await fetch("/api/profile/views", { cache: "no-store" });
        const data = await response.json();
        if (!active || !response.ok) return;
        setViews(Number(data.views ?? profile.views));
      } catch {
      }
    };

    void loadViews();
    const timer = setInterval(() => void loadViews(), POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [profile.views]);

  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-5">
        <div className="flex items-center gap-3">
          {profile.image ? (
            <Image
              src={profile.image}
              alt={profile.name}
              width={56}
              height={56}
              className="h-14 w-14 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-700">
              {profile.name ? profile.name.charAt(0).toUpperCase() : "?"}
            </span>
          )}

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{profile.name}</p>
            <p className="truncate text-xs text-slate-500">@{profile.username}</p>
            <p className="mt-1 text-xs text-slate-600">{profile.role}</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Skills</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.skills.length > 0 ? (
              profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">No skills yet</span>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-3 border-t border-slate-200 pt-4 text-sm">
          <p className="flex items-center justify-between gap-3 text-slate-700">
            <span>Location</span>
            <span className="font-medium text-slate-900">{profile.location || "-"}</span>
          </p>
          <p className="flex items-center justify-between gap-3 text-slate-700">
            <span>Profile views</span>
            <span className="font-medium text-slate-900">{views}</span>
          </p>
        </div>
      </div>
    </aside>
  );
}