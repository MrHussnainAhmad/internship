"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import { LiveChat } from "@/components/live-chat";

type Applicant = {
  applicationId: string;
  id: string;
  name: string;
  email: string;
  username: string;
  resumeUrl: string;
  appliedAt: string;
  status: "pending" | "accepted" | "rejected";
};

type Props = {
  internshipId: string;
  applicants: Applicant[];
};

export function CompanyApplicantsChat({ internshipId, applicants }: Props) {
  const [activeChatId, setActiveChatId] = useState("");
  const [activeApplicantName, setActiveApplicantName] = useState("");
  const [busyApplicantId, setBusyApplicantId] = useState("");
  const [decidingApplicantId, setDecidingApplicantId] = useState("");
  const [statuses, setStatuses] = useState<Record<string, Applicant["status"]>>(
    Object.fromEntries(applicants.map((item) => [item.applicationId, item.status]))
  );
  const [error, setError] = useState("");

  const connect = (applicant: Applicant) => {
    setBusyApplicantId(applicant.id);
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/chats/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            internshipId,
            studentId: applicant.id,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Could not start chat");
          return;
        }
        setActiveChatId(String(data.chatId ?? ""));
        setActiveApplicantName(applicant.name);
      } catch {
        setError("Could not start chat");
      } finally {
        setBusyApplicantId("");
      }
    });
  };

  const decide = (applicant: Applicant, decision: "accepted" | "rejected") => {
    if (decidingApplicantId) return;
    const previous = statuses[applicant.applicationId] ?? applicant.status;
    setStatuses((prev) => ({ ...prev, [applicant.applicationId]: decision }));
    setDecidingApplicantId(applicant.applicationId);
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/application-decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId: applicant.applicationId, decision }),
        });
        const data = await response.json();
        if (!response.ok) {
          setStatuses((prev) => ({ ...prev, [applicant.applicationId]: previous }));
          setError(data.error ?? "Could not update application");
          return;
        }
        const next = String(data.status ?? decision) as Applicant["status"];
        setStatuses((prev) => ({ ...prev, [applicant.applicationId]: next }));
      } catch {
        setStatuses((prev) => ({ ...prev, [applicant.applicationId]: previous }));
        setError("Could not update application");
      } finally {
        setDecidingApplicantId("");
      }
    });
  };

  return (
    <div className="mt-5 space-y-3">
      {applicants.map((applicant) => {
        const status = statuses[applicant.applicationId] ?? applicant.status;

        return (
          <div
            key={applicant.id}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {applicant.username ? (
                    <Link
                      href={`/profiles/${applicant.username}`}
                      className="text-[15px] font-semibold text-slate-900 transition hover:text-slate-700"
                    >
                      {applicant.name}
                    </Link>
                  ) : (
                    <p className="text-[15px] font-semibold text-slate-900">{applicant.name}</p>
                  )}

                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                      status === "accepted"
                        ? "bg-emerald-50 text-emerald-700"
                        : status === "rejected"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {status}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-600">{applicant.email}</p>

                <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                  <p>
                    <span className="font-medium text-slate-800">Applied:</span>{" "}
                    {applicant.appliedAt
                      ? new Date(applicant.appliedAt).toLocaleString()
                      : "Unknown"}
                  </p>
                  <p>
                    <span className="font-medium text-slate-800">Resume:</span>{" "}
                    {applicant.resumeUrl ? (
                      <a
                        href={applicant.resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:decoration-slate-900"
                      >
                        View resume
                      </a>
                    ) : (
                      <span className="text-slate-500">Not uploaded</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  title={busyApplicantId === applicant.id ? "Contacting" : "Contact"}
                  aria-label={busyApplicantId === applicant.id ? "Contacting" : "Contact"}
                  onClick={() => connect(applicant)}
                  disabled={busyApplicantId === applicant.id}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {busyApplicantId === applicant.id ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" className="opacity-30" />
                      <path d="M21 12a9 9 0 0 0-9-9" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                    </svg>
                  )}
                  <span>{busyApplicantId === applicant.id ? "Opening..." : "Message"}</span>
                </button>

                {status === "pending" ? (
                  <>
                    <button
                      type="button"
                      title="Accept applicant"
                      aria-label="Accept applicant"
                      onClick={() => decide(applicant, "accepted")}
                      disabled={decidingApplicantId === applicant.applicationId}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      title="Reject applicant"
                      aria-label="Reject applicant"
                      onClick={() => decide(applicant, "rejected")}
                      disabled={decidingApplicantId === applicant.applicationId}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {activeChatId ? (
        <div className="fixed bottom-4 right-4 z-50 flex h-[min(78vh,720px)] w-[calc(100vw-2rem)] max-w-[460px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Message {activeApplicantName}</p>
              <p className="text-xs text-slate-500">Applicant conversation</p>
            </div>
            <button
              type="button"
              title="Close chat"
              aria-label="Close chat"
              onClick={() => setActiveChatId("")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m18 6-12 12" />
                <path d="m6 6 12 12" />
              </svg>
              <span className="sr-only">Close</span>
            </button>
          </div>
          <div className="flex-1 overflow-auto bg-slate-50/40 p-3">
            <LiveChat chatId={activeChatId} title={`Chat with ${activeApplicantName}`} />
          </div>
        </div>
      ) : null}
    </div>
  );
}