"use client";

import { startTransition, useState } from "react";

type Props = {
  targetUserId: string;
  initialConnected: boolean;
  initialFollowersCount: number;
  initialFollowingCount: number;
};

export function ConnectButton({
  targetUserId,
  initialConnected,
  initialFollowersCount,
  initialFollowingCount,
}: Props) {
  const [connected, setConnected] = useState(initialConnected);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [followingCount] = useState(initialFollowingCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggle = () => {
    if (busy) return;

    const previousConnected = connected;
    const previousFollowers = followersCount;
    const nextConnected = !previousConnected;

    setConnected(nextConnected);
    setFollowersCount(Math.max(0, previousFollowers + (nextConnected ? 1 : -1)));
    setBusy(true);
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/connections/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId }),
        });
        const data = await response.json();
        if (!response.ok) {
          setConnected(previousConnected);
          setFollowersCount(previousFollowers);
          setError(data.error ?? "Could not update connection");
          return;
        }

        const serverConnected = Boolean(data.connected);
        setConnected(serverConnected);
        setFollowersCount(
          Math.max(
            0,
            previousFollowers +
              (serverConnected ? 1 : 0) -
              (previousConnected ? 1 : 0)
          )
        );
      } catch {
        setConnected(previousConnected);
        setFollowersCount(previousFollowers);
        setError("Could not update connection");
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={toggle}
        title={busy ? "Updating connection" : connected ? "Connected" : "Connect"}
        aria-label={busy ? "Updating connection" : connected ? "Connected" : "Connect"}
        disabled={busy}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {busy ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" className="opacity-30" />
            <path d="M21 12a9 9 0 0 0-9-9" />
          </svg>
        ) : connected ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
        <span className="sr-only">
          {busy ? "Updating connection" : connected ? "Connected" : "Connect"}
        </span>
      </button>
      <p className="text-xs text-slate-600">
        Followers: {followersCount} • Following: {followingCount}
      </p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
