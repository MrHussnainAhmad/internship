"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type SidebarLeftProps = {
  profile: {
    name: string;
    username: string;
    role: string;
    image: string;
    location: string;
    views: number;
    followersCount: number;
    followingCount: number;
  };
};

export function SidebarLeft({ profile }: SidebarLeftProps) {
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
        // keep previous value when polling fails
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
    <aside className="space-y-4 md:sticky md:top-20 md:self-start">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-lg font-semibold text-slate-700">
              {profile.name ? profile.name.charAt(0).toUpperCase() : "?"}
            </span>
          )}
          <div>
            <p className="text-sm font-semibold text-slate-900">{profile.name}</p>
            <p className="text-xs text-slate-600 capitalize">{profile.role}</p>
            <p className="text-xs text-slate-500">{profile.location || "-"}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm">
          <div className="flex items-center justify-between text-slate-700">
            <span>Profile views</span>
            <span className="font-semibold text-slate-900">{views}</span>
          </div>
          <div className="flex items-center justify-between text-slate-700">
            <span>Followers</span>
            <span className="font-semibold text-slate-900">{profile.followersCount}</span>
          </div>
          <div className="flex items-center justify-between text-slate-700">
            <span>Connections</span>
            <span className="font-semibold text-slate-900">{profile.followingCount}</span>
          </div>
        </div>
      </section>

    </aside>
  );
}
