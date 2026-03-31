import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { ApplyButton } from "@/components/apply-button";
import { SaveInternshipButton } from "@/components/save-internship-button";
import { ConnectButton } from "@/components/connect-button";
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

function normalizeSkills(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const set = new Set<string>();
  for (const value of values) {
    const skill = String(value ?? "").trim().toLowerCase();
    if (!skill) continue;
    set.add(skill);
  }
  return [...set];
}

function calcMatch(required: string[], current: string[]) {
  if (required.length === 0 || current.length === 0) {
    return { matchedSkills: [] as string[], matchPercent: 0 };
  }
  const set = new Set(current.map((item) => item.toLowerCase()));
  const matchedSkills = required.filter((item) => set.has(item.toLowerCase()));
  const matchPercent = Math.round((matchedSkills.length / required.length) * 100);
  return { matchedSkills, matchPercent };
}

function timeAgo(iso: string, nowTs: number) {
  const diff = Math.max(1, Math.floor((nowTs - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

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

  const now = new Date();
  const nowTs = now.getTime();
  const db = await getDb();

  const session = await auth();
  const userRole = session?.user?.role;
  const isOwner = session?.user?.id === internship.companyId;
  const canApply = userRole === "student";
  const viewerObjectId =
    session?.user?.id && ObjectId.isValid(session.user.id)
      ? new ObjectId(session.user.id)
      : null;

  const companyObjectId = new ObjectId(internship.companyId);

  const [companyUser, companyFollowersCount, companyFollowingCount, companyViewsCount, companyActiveInternships, initialConnected] =
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
      db.collection("internships").countDocuments({ companyId: companyObjectId }),
      viewerObjectId && !isOwner
        ? db
            .collection("connections")
            .findOne({ fromUserId: viewerObjectId, toUserId: companyObjectId })
            .then((row) => Boolean(row))
        : Promise.resolve(false),
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
        .project({ userId: 1, resumeUrl: 1, skills: 1 })
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

  const internshipRequiredSkills = normalizeSkills(internship.skillsRequired);
  const internshipObjectId = new ObjectId(internship._id);

  const [internshipApplications, studentProfile, existingApplication, companyInternshipIds] =
    await Promise.all([
      db
        .collection("applications")
        .find({ internshipId: internshipObjectId })
        .project({ studentId: 1 })
        .toArray(),
      canApply && session?.user?.id
        ? db.collection("studentProfiles").findOne({ userId: new ObjectId(session.user.id) })
        : null,
      canApply && session?.user?.id
        ? db.collection("applications").findOne({
            internshipId: internshipObjectId,
            studentId: new ObjectId(session.user.id),
          })
        : null,
      db
        .collection("internships")
        .find({ companyId: companyObjectId })
        .project({ _id: 1 })
        .toArray()
        .then((rows) =>
          rows.map((row) => row._id).filter((id): id is ObjectId => id instanceof ObjectId)
        ),
    ]);

  const totalApplicants = internshipApplications.length;
  const internshipApplicantIds = internshipApplications
    .map((row) => row.studentId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const internshipApplicantProfiles = internshipApplicantIds.length
    ? await db
        .collection("studentProfiles")
        .find({ userId: { $in: internshipApplicantIds } })
        .project({ userId: 1, skills: 1 })
        .toArray()
    : [];
  const internshipApplicantSkillsMap = new Map(
    internshipApplicantProfiles.map((profile) => [
      String(profile.userId),
      normalizeSkills(profile.skills),
    ])
  );
  const highMatchCandidates = internshipApplications.reduce((count, row) => {
    const studentSkills = internshipApplicantSkillsMap.get(String(row.studentId ?? "")) ?? [];
    const { matchPercent } = calcMatch(internshipRequiredSkills, studentSkills);
    return matchPercent >= 60 ? count + 1 : count;
  }, 0);

  const companyDecisions30d = await db.collection("applications").countDocuments({
    internshipId: { $in: companyInternshipIds },
    status: { $in: ["accepted", "rejected"] },
    updatedAt: { $gte: new Date(nowTs - 30 * 24 * 60 * 60 * 1000) },
  });

  const studentSkills = normalizeSkills(studentProfile?.skills);
  const { matchedSkills, matchPercent } = calcMatch(internshipRequiredSkills, studentSkills);

  const profileCompleteness = (() => {
    if (!studentProfile) return 0;
    const checks = [
      studentSkills.length > 0,
      Boolean(String(studentProfile.resumeUrl ?? "").trim()),
      Boolean(String(studentProfile.education ?? "").trim()),
      Boolean(String(studentProfile.location ?? "").trim()),
      Array.isArray(studentProfile.languages) && studentProfile.languages.length > 0,
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  })();

  const applicationStatus = existingApplication
    ? String(existingApplication.status ?? "pending")
    : "";
  const appliedInternshipIds =
    canApply && session?.user?.id
      ? await db
          .collection("applications")
          .find(
            { studentId: new ObjectId(session.user.id) },
            { projection: { internshipId: 1 } }
          )
          .toArray()
          .then((rows) =>
            rows
              .map((row) => row.internshipId)
              .filter((id): id is ObjectId => id instanceof ObjectId)
              .map((id) => id.toString())
          )
      : [];

  const relatedInternships = await getRelatedInternships({
    internshipId: internship._id,
    skillsRequired: internship.skillsRequired,
    location: internship.location,
    limit: 6,
    excludeInternshipIds: appliedInternshipIds,
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

            {viewerObjectId && !isOwner ? (
              <div className="mt-3 flex justify-end">
                <ConnectButton
                  targetUserId={internship.companyId}
                  initialConnected={initialConnected}
                  initialFollowersCount={companyFollowersCount}
                  initialFollowingCount={companyFollowingCount}
                  className="items-end"
                  compact
                  showCounts={false}
                />
              </div>
            ) : null}

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
              {internship.company?.location || internship.location}, {internship.company?.country || internship.country}
            </p>
            {internship.company?.industry ? (
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Industry:</span> {internship.company.industry}
              </p>
            ) : null}
            {internship.company?.description ? (
              <p className="mt-2 text-sm text-slate-700">{internship.company.description}</p>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Company credibility</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between text-slate-700">
                <span>Active internships</span>
                <span className="font-semibold text-slate-900">{companyActiveInternships}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Hiring activity (30d)</span>
                <span className="font-semibold text-slate-900">{companyDecisions30d}</span>
              </div>
            </div>
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

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">{internship.title}</h1>
                <p className="mt-1 text-sm text-slate-600">
                  {internship.location}, {internship.country}
                  {internship.isRemote ? " • Remote friendly" : ""}
                  {` • Posted ${timeAgo(internship.createdAt, nowTs)}`}
                </p>
              </div>
              {canApply ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${matchPercent >= 60 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                    Match {matchPercent}%
                  </span>
                  <SaveInternshipButton internshipId={internship._id} />
                  {!existingApplication ? <ApplyButton internshipSlug={internship.slug} /> : null}
                </div>
              ) : null}
            </div>

            {canApply ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Why this matches you</p>
                <p className="mt-1 text-sm text-emerald-900">
                  {matchedSkills.length > 0
                    ? `Matched skills: ${matchedSkills.slice(0, 5).join(", ")}`
                    : "Add relevant skills in your student profile to improve matching for this role."}
                </p>
              </div>
            ) : null}

            {canApply && existingApplication ? (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Application status</p>
                <p className="mt-1 text-sm font-semibold text-blue-900">
                  {applicationStatus === "accepted"
                    ? "Accepted"
                    : applicationStatus === "rejected"
                      ? "Rejected"
                      : applicationStatus === "pending"
                        ? "Applied • Waiting"
                        : "Applied"}
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-nowrap">
                Level: <strong>{internship.level}</strong>
              </p>
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-nowrap">
                Type: <strong>{internship.type.replaceAll("_", " ")}</strong>
              </p>
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-nowrap">
                Duration: <strong>{internship.duration}</strong>
              </p>
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-nowrap">
                Resume required: <strong>{internship.resumeRequired ? "Yes" : "No"}</strong>
              </p>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Description</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                {internship.description}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {internship.skillsRequired.map((skill) => {
                const matched = matchedSkills.includes(skill.toLowerCase()) || matchedSkills.includes(skill);
                return (
                  <span
                    key={skill}
                    className={`rounded-full border px-2 py-1 text-xs ${matched ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}
                  >
                    {skill}
                  </span>
                );
              })}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Application insights</p>
                <p className="mt-1 text-sm text-slate-700 whitespace-nowrap">Total applicants: <strong>{totalApplicants}</strong></p>
                <p className="text-sm text-slate-700 whitespace-nowrap">High match candidates: <strong>{highMatchCandidates}</strong></p>
              </div>
              {canApply ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Pre-apply checklist</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3 text-sm">
                    <p className={String(studentProfile?.resumeUrl ?? "").trim() ? "text-emerald-700" : "text-slate-600"}>
                      {String(studentProfile?.resumeUrl ?? "").trim() ? "[Done]" : "[Missing]"} Resume uploaded
                    </p>
                    <p className={matchedSkills.length > 0 ? "text-emerald-700" : "text-slate-600"}>
                      {matchedSkills.length > 0 ? "[Done]" : "[Missing]"} Skills match
                    </p>
                    <p className={profileCompleteness >= 70 ? "text-emerald-700" : "text-slate-600"}>
                      {profileCompleteness >= 70 ? "[Done]" : "[Missing]"} Profile completeness ({profileCompleteness}%)
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              {canApply && !existingApplication ? <ApplyButton internshipSlug={internship.slug} /> : null}
              {!canApply && isOwner ? (
                <div className="flex items-center gap-3">
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
                <p className="text-sm text-slate-600">Company accounts cannot apply to internships.</p>
              ) : null}
              {!canApply && !isOwner && !userRole ? (
                <p className="text-sm text-slate-600">Sign in as a student account to apply.</p>
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
                {relatedInternships.map((item) => {
                  const relatedMatch = calcMatch(normalizeSkills(item.skillsRequired), studentSkills).matchPercent;
                  return (
                    <Link
                      key={item.id}
                      href={`/internships/${item.slug}`}
                      className="block rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${relatedMatch >= 60 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                          {relatedMatch}%
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{item.companyName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.location}, {item.country}
                        {item.isRemote ? " • Remote" : ""}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}


