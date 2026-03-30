import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { ApplyButton } from "@/components/apply-button";
import { CompanyApplicantsChat } from "@/components/company-applicants-chat";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getInternshipBySlug, getRelatedInternships } from "@/lib/internships";

type Params = { slug: string };

type OwnerApplicationDoc = {
  _id: ObjectId;
  studentId: ObjectId;
  status?: unknown;
  createdAt?: Date | string;
  resumeUrl?: unknown;
};

export async function generateMetadata(props: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const internship = await getInternshipBySlug(slug);

  if (!internship) return { title: "Internship not found" };

  return {
    title: `${internship.title} in ${internship.location}`,
    description: internship.description,
    alternates: {
      canonical: `/internships/${internship.slug}`,
    },
  };
}

export default async function InternshipDetailPage(props: {
  params: Promise<Params>;
}) {
  const { slug } = await props.params;
  const internship = await getInternshipBySlug(slug);
  if (!internship) notFound();

  const session = await auth();
  const userRole = session?.user?.role;
  const isOwner = session?.user?.id === internship.companyId;
  const canApply = userRole === "student";

  const db = await getDb();
  const companyObjectId = new ObjectId(internship.companyId);

  const [companyUser, companyFollowersCount, companyFollowingCount, companyViewsCount] =
    await Promise.all([
      internship.company?.username
        ? db
            .collection("users")
            .findOne(
              { username: internship.company.username },
              { projection: { image: 1, name: 1 } }
            )
        : null,
      db.collection("connections").countDocuments({ toUserId: companyObjectId }),
      db.collection("connections").countDocuments({ fromUserId: companyObjectId }),
      db.collection("profileViews").countDocuments({ targetUserId: companyObjectId }),
    ]);

  const ownerApplications = isOwner
    ? await db
        .collection("applications")
        .find({ internshipId: new ObjectId(internship._id) })
        .sort({ createdAt: -1 })
        .limit(30)
        .toArray()
        .then((rows) =>
          rows.filter(
            (row): row is OwnerApplicationDoc =>
              row._id instanceof ObjectId && row.studentId instanceof ObjectId
          )
        )
    : [];

  if (isOwner) {
    await db.collection("applications").updateMany(
      {
        internshipId: new ObjectId(internship._id),
        seenByCompany: { $ne: true },
      },
      {
        $set: { seenByCompany: true },
      }
    );
  }

  const applicantIds = ownerApplications
    .map((application) => application.studentId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const applicants = applicantIds.length
    ? await db
        .collection("users")
        .find({ _id: { $in: applicantIds } })
        .project({ _id: 1, name: 1, email: 1, username: 1 })
        .toArray()
    : [];
  const applicantProfiles = applicantIds.length
    ? await db
        .collection("studentProfiles")
        .find({ userId: { $in: applicantIds } })
        .project({ userId: 1, resumeUrl: 1 })
        .toArray()
    : [];
  const applicantMap = new Map(applicants.map((user) => [user._id.toString(), user]));
  const applicantResumeMap = new Map(
    applicantProfiles.map((profile) => [
      String(profile.userId),
      typeof profile.resumeUrl === "string" ? profile.resumeUrl : "",
    ])
  );
  const normalizeStatus = (
    value: unknown
  ): "pending" | "accepted" | "rejected" => {
    if (value === "accepted") return "accepted";
    if (value === "rejected") return "rejected";
    return "pending";
  };
  const applicantCards = ownerApplications.map((application) => {
    const user = applicantMap.get(application.studentId.toString());
    return {
      applicationId: application._id.toString(),
      id: application.studentId.toString(),
      name: String(user?.name ?? "Student"),
      email: String(user?.email ?? "No email"),
      username: String(user?.username ?? ""),
      resumeUrl:
        (typeof application.resumeUrl === "string" && application.resumeUrl) ||
        applicantResumeMap.get(application.studentId.toString()) ||
        "",
      status: normalizeStatus(application.status),
      appliedAt: application.createdAt
        ? new Date(application.createdAt).toISOString()
        : "",
    };
  });

  const relatedInternships = await getRelatedInternships({
    internshipId: internship._id,
    skillsRequired: internship.skillsRequired,
    location: internship.location,
    limit: 6,
  });

  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 py-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,680px)_300px]">
        <aside className="space-y-4 md:sticky md:top-20 md:self-start">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Company profile
            </p>

            <div className="flex items-center gap-3">
              {companyUser?.image ? (
                <Image
                  src={String(companyUser.image)}
                  alt={internship.company?.companyName ?? "Company"}
                  width={52}
                  height={52}
                  className="h-[52px] w-[52px] rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <span className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-lg font-semibold text-slate-700">
                  {(internship.company?.companyName ?? "C").charAt(0).toUpperCase()}
                </span>
              )}

              <div>
                {internship.company?.username ? (
                  <Link
                    href={`/profiles/${internship.company.username}`}
                    className="text-sm font-semibold text-slate-900 hover:text-blue-700"
                  >
                    {internship.company?.companyName ?? "Company"}
                  </Link>
                ) : (
                  <p className="text-sm font-semibold text-slate-900">
                    {internship.company?.companyName ?? "Company"}
                  </p>
                )}
                <p className="text-xs text-slate-600">Company</p>
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm">
              <div className="flex items-center justify-between text-slate-700">
                <span>Profile views</span>
                <span className="font-semibold text-slate-900">{companyViewsCount}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Followers</span>
                <span className="font-semibold text-slate-900">{companyFollowersCount}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Connections</span>
                <span className="font-semibold text-slate-900">{companyFollowingCount}</span>
              </div>
            </div>

            <p className="mt-3 text-sm text-slate-700">
              {internship.company?.location || internship.location},{" "}
              {internship.company?.country || internship.country}
            </p>
            {internship.company?.industry ? (
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Industry:</span>{" "}
                {internship.company.industry}
              </p>
            ) : null}
            {internship.company?.description ? (
              <p className="mt-2 text-sm text-slate-700">{internship.company.description}</p>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <Link
              href="/internships"
              className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Browse internships
            </Link>
            {internship.company?.username ? (
              <Link
                href={`/profiles/${internship.company.username}`}
                className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                View company profile
              </Link>
            ) : null}
            <Link
              href="/notifications"
              className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Notifications
            </Link>
          </section>
        </aside>

        <main className="space-y-6">
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {internship.imageUrl ? (
              <div className="mb-5 overflow-hidden rounded-lg border border-slate-200">
                <Image
                  src={internship.imageUrl}
                  alt={internship.title}
                  width={1200}
                  height={640}
                  className="h-auto w-full"
                />
              </div>
            ) : null}

            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{internship.title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {internship.company?.username ? (
                <Link
                  href={`/profiles/${internship.company.username}`}
                  className="font-medium text-blue-700 hover:text-blue-900"
                >
                  {internship.company?.companyName ?? "Company"}
                </Link>
              ) : (
                <span>{internship.company?.companyName ?? "Company"}</span>
              )}{" "}
              - {internship.location}, {internship.country}
              {internship.isRemote ? " - Remote friendly" : ""}
            </p>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Description</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                {internship.description}
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Level: <strong>{internship.level}</strong>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Type: <strong>{internship.type.replaceAll("_", " ")}</strong>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Duration: <strong>{internship.duration}</strong>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Resume required: <strong>{internship.resumeRequired ? "Yes" : "No"}</strong>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {internship.skillsRequired.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                >
                  {skill}
                </span>
              ))}
            </div>

            <div className="mt-6">
              {canApply ? (
                <div className="flex justify-end">
                  <ApplyButton internshipSlug={internship.slug} />
                </div>
              ) : null}
              {!canApply && isOwner ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-600">This is your published internship.</p>
                  <Link
                    href={`/internships/${internship.slug}/edit`}
                    className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit internship
                  </Link>
                </div>
              ) : null}
              {!canApply && !isOwner && userRole === "company" ? (
                <p className="text-sm text-slate-600">
                  Company accounts cannot apply to internships.
                </p>
              ) : null}
              {!canApply && !isOwner && !userRole ? (
                <p className="text-sm text-slate-600">
                  Sign in as a student account to apply.
                </p>
              ) : null}
            </div>
          </article>

          {isOwner ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Applications</h2>
              <p className="mt-1 text-sm text-slate-600">
                {ownerApplications.length} candidate(s) applied to this internship.
              </p>
              {ownerApplications.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">No applications yet.</p>
              ) : (
                <CompanyApplicantsChat
                  internshipId={internship._id}
                  applicants={applicantCards}
                />
              )}
            </section>
          ) : null}
        </main>

        <aside className="hidden space-y-4 xl:block xl:sticky xl:top-20 xl:self-start">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Related internships</h2>
            {relatedInternships.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No related internships yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {relatedInternships.map((item) => (
                  <Link
                    key={item.id}
                    href={`/internships/${item.slug}`}
                    className="block rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.companyName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.location}, {item.country}
                      {item.isRemote ? " • Remote" : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.skillsRequired.slice(0, 3).map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
