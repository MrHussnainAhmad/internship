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
    `h-11 w-full rounded-xl border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-0 ${
      errors[field as keyof typeof errors] ? "border-rose-400" : "border-slate-300 focus:border-slate-400"
    }`;

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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-7">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">Company verification</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
          Add your company presence, confirm a domain email, and share at least one proof link.
        </p>
      </div>

      <form onSubmit={startVerification} className="mt-6 space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-800">Website URL</span>
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className={inputClass("websiteUrl")}
            placeholder="https://example.com"
            required
          />
          {errors.websiteUrl ? <span className="mt-1 block text-xs text-rose-600">{errors.websiteUrl}</span> : null}
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-800">LinkedIn URL</span>
            <input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className={inputClass("linkedinUrl")}
              placeholder="https://linkedin.com/company/..."
              required
            />
            {errors.linkedinUrl ? <span className="mt-1 block text-xs text-rose-600">{errors.linkedinUrl}</span> : null}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-800">Twitter / X URL</span>
            <input
              value={twitterUrl}
              onChange={(e) => setTwitterUrl(e.target.value)}
              className={inputClass("twitterUrl")}
              placeholder="https://x.com/..."
              required
            />
            {errors.twitterUrl ? <span className="mt-1 block text-xs text-rose-600">{errors.twitterUrl}</span> : null}
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-800">Instagram URL</span>
            <input
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              className={inputClass("instagramUrl")}
              placeholder="https://instagram.com/..."
              required
            />
            {errors.instagramUrl ? <span className="mt-1 block text-xs text-rose-600">{errors.instagramUrl}</span> : null}
          </label>
        </div>

        {websiteReady ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-800">Domain email</span>
            <input
              value={domainEmail}
              onChange={(e) => setDomainEmail(e.target.value)}
              className={inputClass("domainEmail")}
              placeholder="hr@yourdomain.com"
              required
            />
            <span className="mt-1 block text-xs text-slate-500">
              Public domains like gmail, yahoo, and hotmail are not allowed.
            </span>
            {errors.domainEmail ? <span className="mt-1 block text-xs text-rose-600">{errors.domainEmail}</span> : null}
          </label>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Enter your website URL first to continue with domain email verification.
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-800">Proof of work links</span>
          <textarea
            value={proofLinksInput}
            onChange={(e) => setProofLinksInput(e.target.value)}
            className={`${inputClass("proofLinks")} min-h-32 py-3`}
            placeholder={"https://play.google.com/store/apps/details?id=...\nhttps://github.com/org/project"}
            required
          />
          <span className="mt-1 block text-xs text-slate-500">
            Add one link per line. Example: Play Store, GitHub, project site, or itch.io.
          </span>
          {errors.proofLinks ? <span className="mt-1 block text-xs text-rose-600">{errors.proofLinks}</span> : null}
        </label>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Sending OTP..." : "Send OTP"}
          </button>
        </div>
      </form>

      {domainEmailReady ? (
        <form
          onSubmit={confirmVerification}
          className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">Domain email verification</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Send the OTP first, then enter the code sent to {domainEmail.trim() || "your domain email"}.
              </p>

              <label className="mt-4 block max-w-xs">
                <span className="mb-1.5 block text-sm font-medium text-slate-800">Enter OTP</span>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className={inputClass("otp")}
                  maxLength={4}
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !otpSent}
              className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify company"}
            </button>
          </div>

          {!otpSent ? (
            <p className="mt-3 text-xs text-amber-700">Send OTP first to enable verification.</p>
          ) : null}
        </form>
      ) : null}

      {message ? <p className="mt-5 text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}
