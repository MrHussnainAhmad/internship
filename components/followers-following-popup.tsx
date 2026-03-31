"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type UserItem = {
  id: string;
  name: string;
  username: string;
  role: string;
};

type Props = {
  followers: UserItem[];
  following: UserItem[];
  followersCount: number;
  followingCount: number;
};

export function FollowersFollowingPopup({
  followers,
  following,
  followersCount,
  followingCount,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState<"" | "followers" | "following">("");
  const items = open === "followers" ? followers : following;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="mt-2 flex items-center gap-5 text-sm text-slate-600">
        <button
          type="button"
          onClick={() => setOpen("followers")}
          className="font-medium text-slate-700 transition hover:text-slate-900"
        >
          <span className="font-semibold text-slate-900">{followersCount}</span> followers
        </button>
        <button
          type="button"
          onClick={() => setOpen("following")}
          className="font-medium text-slate-700 transition hover:text-slate-900"
        >
          <span className="font-semibold text-slate-900">{followingCount}</span> following
        </button>
      </div>

      {open && mounted
        ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                {open === "followers" ? "Followers" : "Following"}
              </h3>
              <button
                type="button"
                onClick={() => setOpen("")}
                className="inline-flex h-8 items-center justify-center rounded-full border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-3">
              {items.length === 0 ? (
                <p className="px-2 py-3 text-sm text-slate-600">No users found.</p>
              ) : (
                <div className="space-y-1">
                  {items.map((user) => (
                    <Link
                      key={user.id}
                      href={`/profiles/${user.username}`}
                      onClick={() => setOpen("")}
                      className="flex items-center justify-between rounded-xl px-3 py-3 transition hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                        <p className="truncate text-xs text-slate-500">@{user.username}</p>
                      </div>
                      <span className="ml-3 shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                        {user.role}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
          ,
          document.body
        )
        : null}
    </>
  );
}
