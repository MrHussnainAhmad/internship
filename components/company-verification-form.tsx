"use client";

import { FormEvent, useState } from "react";

type FieldErrors = Record<string, string>;

export function CompanyVerificationForm() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [domainEmail, setDomainEmail] = useState("");
  const [proofLinksInput, setProofLinksInput] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const websiteReady = websiteUrl.trim().length > 0;
  const domainEmailReady = domainEmail.trim().length > 0;

  const inputClass = (field: string) =>
    `rounded-md border px-3 py-2 ${errors[field] ? "border-rose-400" : "border-slate-300"}`;

  async function startVerification(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setErrors({});

    try {
      const proofLinks = proofLinksInput
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);

      const response = await fetch("/api/company/verify/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl,
          linkedinUrl,
          twitterUrl,
          instagramUrl,
          domainEmail,
          proofLinks,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const next: FieldErrors = {};
        const fieldErrors = data?.issues?.fieldErrors;
        if (fieldErrors && typeof fieldErrors === "object") {
          for (const [key, value] of Object.entries(fieldErrors)) {
            const first = Array.isArray(value) ? value[0] : value;
            if (first) next[key] = String(first);
          }
        }
        if (Object.keys(next).length > 0) setErrors(next);
        setMessage(String(data?.error ?? "Could not send OTP"));
        return;
      }

      setOtpSent(true);
      setMessage(
        data?.devOtpPreview
          ? `OTP sent. Dev preview OTP: ${data.devOtpPreview}`
          : "OTP sent to your domain email."
      );
    } catch {
      setMessage("Failed to start verification.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmVerification(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/company/verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(String(data?.error ?? "Invalid OTP"));
        return;
      }

      setMessage("Verified successfully. Redirecting to profile...");
      window.location.href = "/profile";
    } catch {
      setMessage("Could not verify OTP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Get Verified</h1>
      <p className="mt-1 text-sm text-slate-600">
        Company verification requires all company links, domain email OTP, and at least one proof link.
      </p>

      <form onSubmit={startVerification} className="mt-5 space-y-4">
        <label className="flex flex-col gap-1 text-sm">
          Website URL (required)
          <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className={inputClass("websiteUrl")} placeholder="https://example.com" required />
          {errors.websiteUrl ? <span className="text-xs text-rose-600">{errors.websiteUrl}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          LinkedIn URL (required)
          <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} className={inputClass("linkedinUrl")} placeholder="https://linkedin.com/company/..." required />
          {errors.linkedinUrl ? <span className="text-xs text-rose-600">{errors.linkedinUrl}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Twitter URL (required)
          <input value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} className={inputClass("twitterUrl")} placeholder="https://x.com/..." required />
          {errors.twitterUrl ? <span className="text-xs text-rose-600">{errors.twitterUrl}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Instagram URL (required)
          <input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} className={inputClass("instagramUrl")} placeholder="https://instagram.com/..." required />
          {errors.instagramUrl ? <span className="text-xs text-rose-600">{errors.instagramUrl}</span> : null}
        </label>

        {websiteReady ? (
          <label className="flex flex-col gap-1 text-sm">
            Domain email (required)
            <input value={domainEmail} onChange={(e) => setDomainEmail(e.target.value)} className={inputClass("domainEmail")} placeholder="hr@yourdomain.com" required />
            <span className="text-xs text-slate-500">Public domains like gmail/hotmail/yahoo are blocked.</span>
            {errors.domainEmail ? <span className="text-xs text-rose-600">{errors.domainEmail}</span> : null}
          </label>
        ) : (
          <p className="text-xs text-slate-500">Enter website URL first to continue with domain email verification.</p>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Proof of work links (required, one per line)
          <textarea value={proofLinksInput} onChange={(e) => setProofLinksInput(e.target.value)} className={inputClass("proofLinks") + " min-h-28"} placeholder={"https://play.google.com/store/apps/details?id=...\nhttps://github.com/org/project"} required />
          <span className="text-xs text-slate-500">At least one link: Play Store / itch.io / GitHub / project site.</span>
          {errors.proofLinks ? <span className="text-xs text-rose-600">{errors.proofLinks}</span> : null}
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Sending OTP..." : "Send OTP"}
        </button>
      </form>

      {domainEmailReady ? (
        <form onSubmit={confirmVerification} className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Domain email verification</p>
          <p className="text-xs text-slate-600">
            1) Click <span className="font-semibold">Send OTP</span> above.
            2) Enter OTP from {domainEmail.trim() || "your domain email"}.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Enter OTP
            <input value={otp} onChange={(e) => setOtp(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2" maxLength={4} required />
          </label>
          <button
            type="submit"
            disabled={loading || !otpSent}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify Company"}
          </button>
          {!otpSent ? (
            <p className="text-xs text-amber-700">Send OTP first to enable verify.</p>
          ) : null}
        </form>
      ) : null}

      {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}
