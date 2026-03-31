export function VerifiedBadge({ trustedLabel = true }: { trustedLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
        <path d="m12 2 2.4 2.4 3.3-.5.5 3.3L20.6 10 18 12l.6 2.8-2.8.6-.5 3.3-3.3-.5L12 21l-2.4-2.4-3.3.5-.5-3.3-2.8-.6L3.4 12 6 10l-.6-2.8 2.8-.6.5-3.3 3.3.5Z" />
      </svg>
      {trustedLabel ? <span>Verified</span> : null}
    </span>
  );
}