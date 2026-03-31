const FALLBACK_SITE_URL = "http://localhost:3000";

function normalizeBase(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function getSiteBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      return normalizeBase(new URL(raw).toString());
    } catch {
      return FALLBACK_SITE_URL;
    }
  }
  return FALLBACK_SITE_URL;
}

export function toAbsoluteUrl(path: string, origin?: string) {
  const base = origin?.trim() || getSiteBaseUrl();
  return new URL(path, base).toString();
}
