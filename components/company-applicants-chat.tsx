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
    <div className="mt-4 space-y-3">
      {applicants.map((applicant) => (
        <div key={applicant.id} className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              {applicant.username ? (
                <Link
                  href={`/profiles/${applicant.username}`}
                  className="font-medium text-slate-900 hover:text-blue-700"
                >
                  {applicant.name}
                </Link>
              ) : (
                <p className="font-medium text-slate-900">{applicant.name}</p>
              )}
              <p className="text-sm text-slate-600">{applicant.email}</p>
              <p className="text-xs text-slate-500">
                Applied:{" "}
                {applicant.appliedAt
                  ? new Date(applicant.appliedAt).toLocaleString()
                  : "Unknown"}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Status: {statuses[applicant.applicationId] ?? applicant.status}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                title={busyApplicantId === applicant.id ? "Contacting" : "Contact"}
                aria-label={busyApplicantId === applicant.id ? "Contacting" : "Contact"}
                onClick={() => connect(applicant)}
                disabled={busyApplicantId === applicant.id}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60"
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
                <span className="sr-only">
                  {busyApplicantId === applicant.id ? "Contacting" : "Contact"}
                </span>
              </button>
              <div className="flex gap-2">
                {(statuses[applicant.applicationId] ?? applicant.status) === "pending" ? (
                  <>
                    <button
                      type="button"
                      title="Accept applicant"
                      aria-label="Accept applicant"
                      onClick={() => decide(applicant, "accepted")}
                      disabled={decidingApplicantId === applicant.applicationId}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-700 text-white disabled:opacity-60"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="sr-only">Accept applicant</span>
                    </button>
                    <button
                      type="button"
                      title="Reject applicant"
                      aria-label="Reject applicant"
                      onClick={() => decide(applicant, "rejected")}
                      disabled={decidingApplicantId === applicant.applicationId}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-rose-700 text-white disabled:opacity-60"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m18 6-12 12" />
                        <path d="m6 6 12 12" />
                      </svg>
                      <span className="sr-only">Reject applicant</span>
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ))}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {activeChatId ? (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-[440px] rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">
              Contact {activeApplicantName}
            </p>
            <button
              type="button"
              title="Close chat"
              aria-label="Close chat"
              onClick={() => setActiveChatId("")}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m18 6-12 12" />
                <path d="m6 6 12 12" />
              </svg>
              <span className="sr-only">Close</span>
            </button>
          </div>
          <div className="p-2">
            <LiveChat chatId={activeChatId} title={`Chat with ${activeApplicantName}`} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
