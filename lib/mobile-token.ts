import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/lib/env";

type MobileTokenPayload = {
  sub: string;
  email: string;
  role?: "student" | "company";
  username?: string;
  exp: number;
};

const header = {
  alg: "HS256",
  typ: "JWT",
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(input: string) {
  const secret = requireEnv("AUTH_SECRET");
  return createHmac("sha256", secret).update(input).digest("base64url");
}

export function createMobileAccessToken(input: {
  sub: string;
  email: string;
  role?: "student" | "company";
  username?: string;
  expiresInSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload: MobileTokenPayload = {
    sub: input.sub,
    email: input.email,
    role: input.role,
    username: input.username,
    exp: now + (input.expiresInSeconds ?? 60 * 60 * 24 * 14),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyMobileAccessToken(token: string): MobileTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, providedSignature] = parts;
  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as MobileTokenPayload;
    if (!parsed.sub || !parsed.email || !parsed.exp) return null;
    if (Math.floor(Date.now() / 1000) >= parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

