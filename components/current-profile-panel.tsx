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
        // keep last count if polling fails
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
    <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {profile.image ? (
          <Image
            src={profile.image}
            alt={profile.name}
            width={52}
            height={52}
            className="h-[52px] w-[52px] rounded-full border border-slate-200 object-cover"
          />
        ) : (
          <span className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-lg font-semibold text-slate-700">
            {profile.name ? profile.name.charAt(0).toUpperCase() : "?"}
          </span>
        )}
        <div>
          <p className="text-sm font-semibold text-slate-900">{profile.name}</p>
          <p className="text-xs text-slate-600">@{profile.username}</p>
        </div>
      </div>
      <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">Skills</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {profile.skills.length > 0 ? (
          profile.skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
            >
              {skill}
            </span>
          ))
        ) : (
          <span className="text-xs text-slate-500">No skills yet</span>
        )}
      </div>
      <p className="mt-3 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Location:</span>{" "}
        {profile.location || "-"}
      </p>
      <p className="mt-1 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Profile views:</span> {views}
      </p>
    </aside>
  );
}
