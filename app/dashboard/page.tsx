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
  if (tag === "Top Match") return "bg-emerald-100 text-emerald-800";
  if (tag === "Medium") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
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
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Company dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Decision board to review applicants and hire faster.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Internships posted</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{postedInternships.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total applicants</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{totalApplications}</p>
          </div>
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm text-emerald-700">Top-match candidates (70%+)</p>
            <p className="mt-1 text-3xl font-bold text-emerald-900">{totalHighMatch}</p>
          </div>
        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Internship pipeline</h2>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <Link
                href="/dashboard?applicants=all"
                className={`rounded-full border px-3 py-1 ${applicantFilter === "all" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-700"}`}
              >
                All
              </Link>
              <Link
                href="/dashboard?applicants=top_match"
                className={`rounded-full border px-3 py-1 ${applicantFilter === "top_match" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-700"}`}
              >
                Top match (70%+)
              </Link>
              <Link
                href="/dashboard?applicants=has_resume"
                className={`rounded-full border px-3 py-1 ${applicantFilter === "has_resume" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-700"}`}
              >
                Has resume
              </Link>
              <Link
                href="/dashboard?applicants=recent"
                className={`rounded-full border px-3 py-1 ${applicantFilter === "recent" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-700"}`}
              >
                Recent
              </Link>
            </div>
          </div>

          {postedInternships.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No listings yet. Post your first internship to start hiring.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {postedInternships.map((internship) => {
                const row = listingRows.find((item) => item.internshipId === internship._id.toString());
                const applicants = row?.recentApplicants ?? [];
                return (
                  <article key={internship._id.toString()} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{String(internship.title ?? "Internship")}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Total applicants: <span className="font-semibold text-slate-900">{row?.totalApplicants ?? 0}</span>
                          {" • "}High match: <span className="font-semibold text-emerald-700">{row?.highMatchCandidates ?? 0}</span>
                          {" • "}Resume uploaded: <span className="font-semibold text-slate-900">{row?.resumeUploaded ?? 0}</span>
                        </p>
                      </div>
                      <Link
                        href={`/internships/${String(internship.slug ?? "")}`}
                        className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                      >
                        View listing
                      </Link>
                    </div>

                    {applicants.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {applicants.map((app) => (
                          <div key={app.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{app.studentName}</p>
                              <p className="text-xs text-slate-600">
                                Match {app.matchPercent}%
                                {app.studentUsername ? ` • @${app.studentUsername}` : ""}
                                {` • Applied ${daysSince(app.appliedAt, nowTs)}d ago`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(app.tag)}`}>
                                {app.tag}
                              </span>
                              {app.hasResume ? (
                                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">Resume</span>
                              ) : (
                                <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">No resume</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">No applicants in this filter.</p>
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
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Student dashboard</h1>
      <p className="mt-1 text-sm text-slate-600">Decision board for applications, profile quality, and next moves.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total applications</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{statusCounts.applied}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Response rate</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{responseRate}%</p>
        </div>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm text-amber-700">Pending</p>
          <p className="mt-1 text-3xl font-bold text-amber-900">{statusCounts.pending}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Application progress tracker</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-5">
            <div className="rounded-lg border border-slate-200 p-3 text-center">
              <p className="text-xs uppercase text-slate-500">Applied</p>
              <p className="text-2xl font-bold text-slate-900">{statusCounts.applied}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
              <p className="text-xs uppercase text-blue-700">Viewed</p>
              <p className="text-2xl font-bold text-blue-900">{statusCounts.viewed}</p>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-center">
              <p className="text-xs uppercase text-indigo-700">Interview</p>
              <p className="text-2xl font-bold text-indigo-900">{statusCounts.interview}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
              <p className="text-xs uppercase text-emerald-700">Accepted</p>
              <p className="text-2xl font-bold text-emerald-900">{statusCounts.accepted}</p>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center">
              <p className="text-xs uppercase text-rose-700">Rejected</p>
              <p className="text-2xl font-bold text-rose-900">{statusCounts.rejected}</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Smart next action</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {smartActions.map((action) => (
              <li key={action} className="rounded-md bg-slate-50 px-3 py-2">{action}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <Link href="/onboarding?edit=1" className="rounded-full border border-slate-300 px-3 py-1 text-slate-700">
              Improve profile
            </Link>
            <Link href="/internships" className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-blue-700">
              Apply more
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Profile strength meter</h2>
          <div className="mt-4">
            <div className="h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-blue-700" style={{ width: `${completion}%` }} />
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{completion}% complete</p>
            <p className="mt-1 text-xs text-slate-600">Based on skills, resume, projects, and profile completion.</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-700">
            <div className="rounded-md bg-slate-50 px-3 py-2">Skills: {studentSkills.length}</div>
            <div className="rounded-md bg-slate-50 px-3 py-2">Projects: {projectsCount}</div>
            <div className="rounded-md bg-slate-50 px-3 py-2">Resume: {String(studentProfile?.resumeUrl ?? "").trim() ? "Yes" : "No"}</div>
            <div className="rounded-md bg-slate-50 px-3 py-2">Links: {linksCount}</div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Resume score (rule-based)</h2>
          <div className="mt-4">
            <div className="h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${resumeRuleScore}%` }} />
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{resumeRuleScore}/100</p>
            <p className="mt-1 text-xs text-slate-600">Rules: education 25, skills 25, projects 30, links 20.</p>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Follow-up system</h2>
        {stalePending.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No follow-ups due. A follow-up appears when an application is pending for {FOLLOW_UP_AFTER_DAYS}+ days.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {stalePending.map((application) => {
              const internship = internshipMap.get(String(application.internshipId ?? ""));
              return (
                <article key={String(application._id)} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{String(internship?.title ?? "Internship")}</p>
                      <p className="text-xs text-slate-600">
                        Pending for {daysSince(application.updatedAt ?? application.createdAt ?? now, nowTs)} days
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {internship?.slug ? (
                        <Link
                          href={`/internships/${String(internship.slug)}`}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          View details
                        </Link>
                      ) : null}
                      <Link
                        href="/chats"
                        className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
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




