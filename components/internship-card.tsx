import Link from "next/link";

type InternshipCardProps = {
  internship: {
    _id: string;
    slug: string;
    title: string;
    companyName: string;
    location: string;
    country: string;
    isRemote: boolean;
    type: string;
    level: string;
    skillsRequired: string[];
    description: string;
  };
};

export function InternshipCard({ internship }: InternshipCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-slate-900">
            {internship.title}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{internship.companyName}</p>
        </div>

        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {internship.type.replaceAll("_", " ")}
        </span>
      </div>

      <p className="mt-3 text-sm text-slate-700">
        {internship.location}, {internship.country}
        {internship.isRemote ? " · Remote friendly" : ""}
      </p>

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {internship.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {internship.skillsRequired.slice(0, 4).map((skill) => (
          <span
            key={skill}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
          >
            {skill}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {internship.level}
        </span>

        <Link
          href={`/internships/${internship.slug}`}
          className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          View details
        </Link>
      </div>
    </article>
  );
}