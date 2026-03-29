"use client";

import Link from "next/link";
import { useState } from "react";

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
  const [open, setOpen] = useState<"" | "followers" | "following">("");
  const items = open === "followers" ? followers : following;

  return (
    <>
      <div className="mt-1 flex items-center gap-4 text-sm text-slate-600">
        <button
          type="button"
          onClick={() => setOpen("followers")}
          className="font-medium text-blue-700 hover:text-blue-900"
        >
          Followers: {followersCount}
        </button>
        <button
          type="button"
          onClick={() => setOpen("following")}
          className="font-medium text-blue-700 hover:text-blue-900"
        >
          Following: {followingCount}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">
                {open === "followers" ? "Followers" : "Following"}
              </h3>
              <button
                type="button"
                onClick={() => setOpen("")}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-slate-600">No users found.</p>
            ) : (
              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {items.map((user) => (
                  <Link
                    key={user.id}
                    href={`/profiles/${user.username}`}
                    onClick={() => setOpen("")}
                    className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 hover:bg-slate-100"
                  >
                    <span className="text-sm font-medium text-slate-900">{user.name}</span>
                    <span className="text-xs text-slate-600">@{user.username}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
