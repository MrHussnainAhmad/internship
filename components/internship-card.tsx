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
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{internship.title}</h3>
          <p className="text-sm text-slate-600">{internship.companyName}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
          {internship.type.replaceAll("_", " ")}
        </span>
      </div>
      <p className="mb-2 text-sm text-slate-700">
        {internship.location}, {internship.country}
        {internship.isRemote ? " • Remote friendly" : ""}
      </p>
      <p className="mb-3 line-clamp-2 text-sm text-slate-600">{internship.description}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {internship.skillsRequired.slice(0, 4).map((skill) => (
          <span
            key={skill}
            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
          >
            {skill}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          {internship.level}
        </span>
        <Link
          href={`/internships/${internship.slug}`}
          className="text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          View details
        </Link>
      </div>
    </article>
  );
}
