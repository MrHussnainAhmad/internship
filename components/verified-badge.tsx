export function VerifiedBadge({ trustedLabel = true }: { trustedLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
      <span aria-hidden>★</span>
      {trustedLabel ? <span>Trusted</span> : null}
    </span>
  );
}
