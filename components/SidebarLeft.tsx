"use client";

import Image from "next/image";

type SidebarLeftProps = {
  profile: {
    name: string;
    username: string;
    role: string;
    image: string;
    location: string;
    applicationProgress: {
      submitted: number;
      pending: number;
      accepted: number;
      rejected: number;
      posted: number;
      totalApplicants: number;
    };
    profileStrength: {
      score: number;
      missing: string[];
    };
  };
};

export function SidebarLeft({ profile }: SidebarLeftProps) {
  const progress = profile.applicationProgress;
  const isStudent = profile.role === "student";

  return (
    <aside className="space-y-4 md:sticky md:top-20 md:self-start">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
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
              <p className="text-xs text-slate-600 capitalize">{profile.role}</p>
              <p className="truncate text-xs text-slate-500">{profile.location || "-"}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <h2 className="text-sm font-semibold text-slate-900">Application progress</h2>

        <div className="mt-4 space-y-3 text-sm">
          {isStudent ? (
            <>
              <div className="flex items-center justify-between text-slate-700">
                <span>Submitted</span>
                <span className="font-semibold text-slate-900">{progress.submitted}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Pending</span>
                <span className="font-semibold text-slate-900">{progress.pending}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Accepted</span>
                <span className="font-semibold text-slate-900">{progress.accepted}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Rejected</span>
                <span className="font-semibold text-slate-900">{progress.rejected}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-slate-700">
                <span>Internships posted</span>
                <span className="font-semibold text-slate-900">{progress.posted}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Total applicants</span>
                <span className="font-semibold text-slate-900">{progress.totalApplicants}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Pending review</span>
                <span className="font-semibold text-slate-900">{progress.pending}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Accepted</span>
                <span className="font-semibold text-slate-900">{progress.accepted}</span>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <h2 className="text-sm font-semibold text-slate-900">Profile strength</h2>

        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-slate-900"
              style={{ width: `${Math.max(0, Math.min(100, profile.profileStrength.score))}%` }}
            />
          </div>

          <p className="mt-3 text-sm font-semibold text-slate-900">
            {profile.profileStrength.score}% complete
          </p>

          {profile.profileStrength.missing.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
              {profile.profileStrength.missing.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-slate-600">Great profile. Keep it updated.</p>
          )}
        </div>
      </section>
    </aside>
  );
}