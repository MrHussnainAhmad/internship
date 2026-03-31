const DISALLOWED_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "yahoo.com",
  "outlook.com",
  "live.com",
]);

export function normalizeWebsiteDomain(websiteUrl: string) {
  try {
    const url = new URL(websiteUrl.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host;
  } catch {
    return "";
  }
}

export function isValidDomainEmailForWebsite(email: string, websiteDomain: string) {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0) return { ok: false, reason: "Enter a valid domain email." };

  const domain = trimmed.slice(atIndex + 1);
  if (DISALLOWED_EMAIL_DOMAINS.has(domain)) {
    return { ok: false, reason: "Public email domains are not allowed for verification." };
  }

  if (domain !== websiteDomain && !domain.endsWith(`.${websiteDomain}`)) {
    return { ok: false, reason: `Domain email must match website domain (${websiteDomain}).` };
  }

  return { ok: true, reason: "", domain };
}

export function generateOtp() {
  // User requested OTP range 0000..1001
  const value = Math.floor(Math.random() * 1002);
  return String(value).padStart(4, "0");
}

export async function sendVerificationOtpEmail(args: {
  to: string;
  otp: string;
  companyName: string;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Internly <noreply@internly.app>";

  if (!resendKey) {
    return {
      ok: false,
      provider: "none" as const,
      error: "Email provider not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [args.to],
      subject: `Internly verification OTP for ${args.companyName}`,
      html: `<p>Your Internly company verification OTP is:</p><h2>${args.otp}</h2><p>This OTP expires in 10 minutes.</p>`,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { ok: false, provider: "resend" as const, error: text || "Failed to send OTP email." };
  }

  return { ok: true, provider: "resend" as const };
}
