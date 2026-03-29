import Link from "next/link";
import { InternshipCard } from "@/components/internship-card";
import { queryInternships } from "@/lib/internships";

function asString(value: string | string[] | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] ?? "" : value;
}

function makeQuery(base: Record<string, string>, nextPage: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(base)) {
    if (value) params.set(key, value);
  }
  params.set("page", String(nextPage));
  return params.toString();
}

export default async function InternshipsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;

  const q = asString(searchParams.q);
  const location = asString(searchParams.location);
  const level = asString(searchParams.level);
  const type = asString(searchParams.type);
  const page = asString(searchParams.page) || "1";
  const limit = "10";

  const result = await queryInternships({ q, location, level, type, page, limit });
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Internships</h1>
      <p className="mt-1 text-sm text-slate-600">
        Smart search supports skill and location parsing (e.g. unity internship lahore).
      </p>

      <form className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search internships"
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          name="location"
          defaultValue={location}
          placeholder="City or country"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          name="level"
          defaultValue={level}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <select
          name="type"
          defaultValue={type}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
          <option value="learn_and_earn">Learn and Earn</option>
        </select>
        <button
          type="submit"
          title="Apply filters"
          aria-label="Apply filters"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:col-span-1"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          <span>Filters</span>
        </button>
      </form>

      {result.items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-600">No internships found for your filters.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {result.items.map((item) => (
            <InternshipCard key={item._id} internship={item} />
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Page {result.page} of {totalPages}
        </p>
        <div className="flex gap-2">
          {result.page > 1 ? (
            <Link
              href={`/internships?${makeQuery(
                { q, location, level, type, limit },
                result.page - 1
              )}`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              Previous
            </Link>
          ) : null}
          {result.page < totalPages ? (
            <Link
              href={`/internships?${makeQuery(
                { q, location, level, type, limit },
                result.page + 1
              )}`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
