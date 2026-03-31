import Link from "next/link";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireCurrentUser } from "@/lib/current-user";

type SearchParamValue = string | string[] | undefined;

const FOLLOW_UP_AFTER_DAYS = 5;

function asString(value: SearchParamValue) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] ?? "" : value;
}

function normalizeSkills(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const unique = new Set<string>();
  for (const value of values) {
    const skill = String(value ?? "").trim().toLowerCase();
    if (!skill) continue;
    unique.add(skill);
  }
  return [...unique];
}

function calculateMatchPercent(requiredSkills: string[], studentSkills: string[]) {
  if (requiredSkills.length === 0 || studentSkills.length === 0) return 0;
  const studentSkillSet = new Set(studentSkills.map((skill) => skill.toLowerCase()));
  const matchedCount = requiredSkills.filter((skill) => studentSkillSet.has(skill.toLowerCase())).length;
  return Math.round((matchedCount / requiredSkills.length) * 100);
}

function matchTag(percent: number): "Top Match" | "Medium" | "Low" {
  if (percent >= 70) return "Top Match";
  if (percent >= 40) return "Medium";
  return "Low";
}

function badgeClass(tag: "Top Match" | "Medium" | "Low") {
  if (tag === "Top Match") return "border-slate-300 bg-slate-900 text-white";
  if (tag === "Medium") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-slate-300 bg-white text-slate-600";
}

function daysSince(dateInput: unknown, nowTs: number) {
  let date: Date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === "string" || typeof dateInput === "number") {
    date = new Date(dateInput);
  } else {
    date = new Date(nowTs);
  }
  if (Number.isNaN(date.getTime())) {
    date = new Date(nowTs);
  }
  const delta = nowTs - date.getTime();
  return Math.max(0, Math.floor(delta / (24 * 60 * 60 * 1000)));
}

function profileCompletionScore(args: {
  userName: string;
  username: string;
  bio: string;
  skills: string[];
  resumeUrl: string;
  projectsCount: number;
}) {
  const checks = [
    Boolean(args.userName.trim()),
    Boolean(args.username.trim()),
    Boolean(args.bio.trim()),
    args.skills.length >= 3,
    Boolean(args.resumeUrl.trim()),
    args.projectsCount > 0,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

function resumeScore(args: {
  education: string;
  skills: string[];
  projectsCount: number;
  linksCount: number;
}) {
  let score = 0;
  if (args.education.trim()) score += 25;
  score += Math.min(25, args.skills.length * 3);
  score += Math.min(30, args.projectsCount * 10);
  score += Math.min(20, args.linksCount * 10);
  return Math.max(0, Math.min(100, score));
}

export default async function DashboardPage(props: {
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const user = await requireCurrentUser();
  if (!user.username || !user.role) {
    redirect("/onboarding");
  }

  const searchParams = await props.searchParams;
  const now = new Date();
  const nowTs = now.getTime();
  const db = await getDb();

  if (user.role === "company") {
    const applicantFilter = asString(searchParams.applicants) || "all";

    const postedInternships = await db
      .collection("internships")
      .find({ companyId: user._id })
      .project({ _id: 1, title: 1, slug: 1, skillsRequired: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .toArray();

    const internshipIds = postedInternships.map((item) => item._id).filter((id): id is ObjectId => id instanceof ObjectId);

    const rawApplications = internshipIds.length
      ? await db
        .collection("applications")
        .find({ internshipId: { $in: internshipIds } })
        .project({ _id: 1, internshipId: 1, studentId: 1, status: 1, resumeUrl: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .toArray()
      : [];

    const studentIds = rawApplications
      .map((item) => item.studentId)
      .filter((id): id is ObjectId => id instanceof ObjectId);

    const [studentProfiles, studentUsers] = studentIds.length
      ? await Promise.all([
        db
          .collection("studentProfiles")
          .find({ userId: { $in: studentIds } })
          .project({ userId: 1, skills: 1, resumeUrl: 1 })
          .toArray(),
        db
          .collection("users")
          .find({ _id: { $in: studentIds } })
          .project({ _id: 1, name: 1, username: 1 })
          .toArray(),
      ])
      : [[], []];

    const internshipMap = new Map(postedInternships.map((item) => [item._id.toString(), item]));
    const studentProfileMap = new Map(studentProfiles.map((item) => [item.userId.toString(), item]));
    const studentUserMap = new Map(studentUsers.map((item) => [item._id.toString(), item]));

    const byInternship = new Map<
      string,
      {
        internshipId: string;
        title: string;
        slug: string;
        createdAt: string;
        totalApplicants: number;
        highMatchCandidates: number;
        resumeUploaded: number;
        recentApplicants: Array<{
          id: string;
          studentName: string;
          studentUsername: string;
          matchPercent: number;
          tag: "Top Match" | "Medium" | "Low";
          hasResume: boolean;
          appliedAt: string;
        }>;
      }
    >();

    for (const application of rawApplications) {
      if (!(application.internshipId instanceof ObjectId) || !(application.studentId instanceof ObjectId)) {
        continue;
      }
      const internship = internshipMap.get(application.internshipId.toString());
      if (!internship) continue;

      const key = application.internshipId.toString();
      const requiredSkills = normalizeSkills(internship.skillsRequired);
      const studentProfile = studentProfileMap.get(application.studentId.toString());
      const studentSkills = normalizeSkills(studentProfile?.skills);
      const percent = calculateMatchPercent(requiredSkills, studentSkills);
      const hasResume = Boolean(
        String(application.resumeUrl ?? studentProfile?.resumeUrl ?? "").trim()
      );
      const tag = matchTag(percent);
      const studentUser = studentUserMap.get(application.studentId.toString());

      if (!byInternship.has(key)) {
        byInternship.set(key, {
          internshipId: key,
          title: String(internship.title ?? "Internship"),
          slug: String(internship.slug ?? ""),
          createdAt: new Date(internship.createdAt ?? now).toISOString(),
          totalApplicants: 0,
          highMatchCandidates: 0,
          resumeUploaded: 0,
          recentApplicants: [],
        });
      }

      const entry = byInternship.get(key)!;
      entry.totalApplicants += 1;
      if (percent >= 70) entry.highMatchCandidates += 1;
      if (hasResume) entry.resumeUploaded += 1;
      entry.recentApplicants.push({
        id: String(application._id ?? ""),
        studentName: String(studentUser?.name ?? "Student"),
        studentUsername: String(studentUser?.username ?? ""),
        matchPercent: percent,
        tag,
        hasResume,
        appliedAt: new Date(application.createdAt ?? now).toISOString(),
      });
    }

    let listingRows = [...byInternship.values()].map((row) => ({
      ...row,
      recentApplicants: [...row.recentApplicants]
        .sort((a, b) => (a.appliedAt < b.appliedAt ? 1 : -1))
        .slice(0, 5),
    }));

    if (applicantFilter === "top_match") {
      listingRows = listingRows.map((row) => ({
        ...row,
        recentApplicants: row.recentApplicants.filter((app) => app.matchPercent >= 70),
      }));
    } else if (applicantFilter === "has_resume") {
      listingRows = listingRows.map((row) => ({
        ...row,
        recentApplicants: row.recentApplicants.filter((app) => app.hasResume),
      }));
    } else if (applicantFilter === "recent") {
      listingRows = listingRows.map((row) => ({
        ...row,
        recentApplicants: row.recentApplicants.filter((app) => daysSince(app.appliedAt, nowTs) <= 7),
      }));
    }

    listingRows = listingRows.filter((row) => row.totalApplicants > 0 || postedInternships.length > 0);

    const totalApplications = rawApplications.length;
    const totalHighMatch = rawApplications.filter((application) => {
      if (!(application.internshipId instanceof ObjectId) || !(application.studentId instanceof ObjectId)) {
        return false;
      }
      const internship = internshipMap.get(application.internshipId.toString());
      const studentProfile = studentProfileMap.get(application.studentId.toString());
      if (!internship || !studentProfile) return false;
      const percent = calculateMatchPercent(
        normalizeSkills(internship.skillsRequired),
        normalizeSkills(studentProfile.skills)
      );
      return percent >= 70;
    }).length;

    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-8 md:py-10">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-slate-900">
            Company dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Review applicants, monitor listing performance, and move faster on hiring decisions.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            <p className="text-sm text-slate-500">Internships posted</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-900">
              {postedInternships.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            <p className="text-sm text-slate-500">Total applicants</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-900">
              {totalApplications}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            <p className="text-sm text-slate-500">Top-match candidates</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-900">
              {totalHighMatch}
            </p>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Internship pipeline</h2>

            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <Link
                href="/dashboard?applicants=all"
                className={`inline-flex h-9 items-center justify-center rounded-full border px-4 transition ${applicantFilter === "all"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
              >
                All
              </Link>
              <Link
                href="/dashboard?applicants=top_match"
                className={`inline-flex h-9 items-center justify-center rounded-full border px-4 transition ${applicantFilter === "top_match"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
              >
                Top match
              </Link>
              <Link
                href="/dashboard?applicants=has_resume"
                className={`inline-flex h-9 items-center justify-center rounded-full border px-4 transition ${applicantFilter === "has_resume"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
              >
                Has resume
              </Link>
              <Link
                href="/dashboard?applicants=recent"
                className={`inline-flex h-9 items-center justify-center rounded-full border px-4 transition ${applicantFilter === "recent"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
              >
                Recent
              </Link>
            </div>
          </div>

          {postedInternships.length === 0 ? (
            <p className="mt-5 text-sm text-slate-600">
              No listings yet. Post your first internship to start hiring.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {postedInternships.map((internship) => {
                const row = listingRows.find((item) => item.internshipId === internship._id.toString());
                const applicants = row?.recentApplicants ?? [];

                return (
                  <article
                    key={internship._id.toString()}
                    className="rounded-2xl border border-slate-200 p-5"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">
                          {String(internship.title ?? "Internship")}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Total applicants:{" "}
                          <span className="font-semibold text-slate-900">{row?.totalApplicants ?? 0}</span>
                          {" · "}High match:{" "}
                          <span className="font-semibold text-slate-900">{row?.highMatchCandidates ?? 0}</span>
                          {" · "}Resume uploaded:{" "}
                          <span className="font-semibold text-slate-900">{row?.resumeUploaded ?? 0}</span>
                        </p>
                      </div>

                      <Link
                        href={`/internships/${String(internship.slug ?? "")}`}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        View listing
                      </Link>
                    </div>

                    {applicants.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {applicants.map((app) => (
                          <div
                            key={app.id}
                            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{app.studentName}</p>
                              <p className="text-xs text-slate-600">
                                Match {app.matchPercent}%
                                {app.studentUsername ? ` · @${app.studentUsername}` : ""}
                                {` · Applied ${daysSince(app.appliedAt, nowTs)}d ago`}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(app.tag)}`}>
                                {app.tag}
                              </span>
                              <span
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${app.hasResume
                                    ? "border-slate-300 bg-white text-slate-700"
                                    : "border-slate-300 bg-white text-slate-500"
                                  }`}
                              >
                                {app.hasResume ? "Resume" : "No resume"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">No applicants in this filter.</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    );
  }

  const [studentProfile, rawApplications] = await Promise.all([
    db.collection("studentProfiles").findOne({ userId: user._id }),
    db
      .collection("applications")
      .find({ studentId: user._id })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(50)
      .toArray(),
  ]);

  const internshipIds = rawApplications
    .map((item) => item.internshipId)
    .filter((id): id is ObjectId => id instanceof ObjectId);

  const internships = internshipIds.length
    ? await db
      .collection("internships")
      .find({ _id: { $in: internshipIds } })
      .project({ _id: 1, title: 1, slug: 1, companyId: 1 })
      .toArray()
    : [];

  const internshipMap = new Map(internships.map((item) => [item._id.toString(), item]));

  const statusCounts = {
    applied: rawApplications.length,
    viewed: rawApplications.filter((item) => item.seenByCompany === true).length,
    interview: rawApplications.filter((item) => String(item.status ?? "") === "interview").length,
    accepted: rawApplications.filter((item) => String(item.status ?? "") === "accepted").length,
    rejected: rawApplications.filter((item) => String(item.status ?? "") === "rejected").length,
    pending: rawApplications.filter((item) => String(item.status ?? "pending") === "pending").length,
  };

  const resolvedCount = statusCounts.accepted + statusCounts.rejected + statusCounts.interview;
  const responseRate = statusCounts.applied > 0 ? Math.round((resolvedCount / statusCounts.applied) * 100) : 0;

  const studentSkills = normalizeSkills(studentProfile?.skills);
  const projectsCount = Array.isArray(studentProfile?.projects) ? studentProfile.projects.length : 0;
  const linksCount = [
    studentProfile?.portfolioUrl,
    studentProfile?.linkedinUrl,
    studentProfile?.twitterUrl,
    studentProfile?.instagramUrl,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean).length;

  const completion = profileCompletionScore({
    userName: String(user.name ?? ""),
    username: String(user.username ?? ""),
    bio: String(user.bio ?? ""),
    skills: studentSkills,
    resumeUrl: String(studentProfile?.resumeUrl ?? ""),
    projectsCount,
  });

  const resumeRuleScore = resumeScore({
    education: String(studentProfile?.education ?? ""),
    skills: studentSkills,
    projectsCount,
    linksCount,
  });

  const stalePending = rawApplications.filter((item) => {
    const status = String(item.status ?? "pending");
    if (status !== "pending") return false;
    return daysSince(item.updatedAt ?? item.createdAt ?? now, nowTs) >= FOLLOW_UP_AFTER_DAYS;
  });

  const smartActions: string[] = [];
  if (completion < 80) smartActions.push("Complete profile fields to increase recruiter trust.");
  if (statusCounts.applied < 5) smartActions.push("Apply to at least 5 internships for better odds.");
  if (!String(studentProfile?.resumeUrl ?? "").trim()) smartActions.push("Upload resume to unlock resume-required applications.");
  if (stalePending.length > 0) smartActions.push("Follow up on older pending applications.");
  if (smartActions.length === 0) smartActions.push("Keep momentum: apply to 2 new internships this week.");

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 md:py-10">
      <div>
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-slate-900">
          Student dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Track applications, improve profile quality, and focus on next steps.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-500">Total applications</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-900">
            {statusCounts.applied}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-500">Response rate</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-900">
            {responseRate}%
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-500">Pending</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-900">
            {statusCounts.pending}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Application progress</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Applied</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{statusCounts.applied}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Viewed</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{statusCounts.viewed}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Interview</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{statusCounts.interview}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Accepted</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{statusCounts.accepted}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Rejected</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{statusCounts.rejected}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <h2 className="text-lg font-semibold text-slate-900">Smart next action</h2>

          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {smartActions.map((action) => (
              <li key={action} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                {action}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <Link
              href="/onboarding?edit=1"
              className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 px-4 text-slate-700 transition hover:bg-slate-50"
            >
              Improve profile
            </Link>
            <Link
              href="/internships"
              className="inline-flex h-9 items-center justify-center rounded-full bg-slate-900 px-4 text-white transition hover:bg-slate-800"
            >
              Apply more
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <h2 className="text-lg font-semibold text-slate-900">Profile strength</h2>
          <div className="mt-4">
            <div className="h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-slate-900" style={{ width: `${completion}%` }} />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">{completion}% complete</p>
            <p className="mt-1 text-xs text-slate-600">
              Based on skills, resume, projects, and profile completion.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">Skills: {studentSkills.length}</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">Projects: {projectsCount}</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              Resume: {String(studentProfile?.resumeUrl ?? "").trim() ? "Yes" : "No"}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">Links: {linksCount}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <h2 className="text-lg font-semibold text-slate-900">Resume score</h2>
          <div className="mt-4">
            <div className="h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-slate-900" style={{ width: `${resumeRuleScore}%` }} />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">{resumeRuleScore}/100</p>
            <p className="mt-1 text-xs text-slate-600">
              Rules: education 25, skills 25, projects 30, links 20.
            </p>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <h2 className="text-lg font-semibold text-slate-900">Follow-up system</h2>

        {stalePending.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No follow-ups due. A follow-up appears when an application is pending for {FOLLOW_UP_AFTER_DAYS}+ days.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {stalePending.map((application) => {
              const internship = internshipMap.get(String(application.internshipId ?? ""));
              return (
                <article key={String(application._id)} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {String(internship?.title ?? "Internship")}
                      </p>
                      <p className="text-xs text-slate-600">
                        Pending for {daysSince(application.updatedAt ?? application.createdAt ?? now, nowTs)} days
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {internship?.slug ? (
                        <Link
                          href={`/internships/${String(internship.slug)}`}
                          className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          View details
                        </Link>
                      ) : null}
                      <Link
                        href="/chats"
                        className="inline-flex h-9 items-center justify-center rounded-full bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        Follow up now
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}