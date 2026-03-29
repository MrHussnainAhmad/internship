export function formatInternshipTitle(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "";

  return normalized
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}
