import Link from "next/link";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireCurrentUser } from "@/lib/current-user";

type ApplicationDoc = {
  internshipId: ObjectId;
  studentId: ObjectId;
  seenByCompany?: boolean;
  createdAt?: Date;
};

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  if (!user.username || !user.role) {
    redirect("/onboarding");
  }

  const db = await getDb();

  if (user.role === "company") {
    const postedInternships = await db
      .collection("internships")
      .find({ companyId: user._id })
      .project({ _id: 1, title: 1, slug: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .toArray();
    const postedCount = postedInternships.length;

    const internshipIds = postedInternships.map(
      (item) => item._id
    ) as ObjectId[];
    const rawApplications = internshipIds.length
      ? await db
          .collection("applications")
          .find({ internshipId: { $in: internshipIds } })
          .sort({ createdAt: -1 })
          .toArray()
      : [];
    const applications: ApplicationDoc[] = rawApplications
      .filter(
        (item) =>
          item.internshipId instanceof ObjectId && item.studentId instanceof ObjectId
      )
      .map((item) => ({
        internshipId: item.internshipId as ObjectId,
        studentId: item.studentId as ObjectId,
        seenByCompany: item.seenByCompany === true,
        createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
      }));

    const unseenApplications = applications.filter(
      (item) => item.seenByCompany !== true
    );
    const totalApplications = applications.length;

    const internshipMap = new Map(
      postedInternships.map((item) => [item._id.toString(), item])
    );
    const byInternship = new Map<
      string,
      { count: number; latestAt: Date | null; slug: string; title: string }
    >();

    for (const app of applications) {
      const key = app.internshipId.toString();
      const internship = internshipMap.get(key);
      if (!internship) continue;
      const existing = byInternship.get(key);
      const createdAt = app.createdAt ? new Date(app.createdAt) : null;
      if (!existing) {
        byInternship.set(key, {
          count: 1,
          latestAt: createdAt,
          slug: String(internship.slug ?? ""),
          title: String(internship.title ?? ""),
        });
        continue;
      }
      existing.count += 1;
      if (createdAt && (!existing.latestAt || createdAt > existing.latestAt)) {
        existing.latestAt = createdAt;
      }
    }

    return (
      <section className="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Company dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Welcome, {String(user.name)}.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Internships posted</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{postedCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total applications</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{totalApplications}</p>
          </div>
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm text-amber-700">New application alerts</p>
            <p className="mt-1 text-3xl font-bold text-amber-900">
              {unseenApplications.length}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Your listings</h2>
            <Link
              href="/internships/new"
              className="text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              Post new internship
            </Link>
          </div>
          {postedInternships.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              You have not posted any internships yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {postedInternships.map((item) => {
                const stats = byInternship.get(item._id.toString());
                return (
                  <div
                    key={item._id.toString()}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {String(item.title ?? "")}
                        </h3>
                        <p className="text-sm text-slate-600">
                          Applications: {stats?.count ?? 0}
                        </p>
                      </div>
                      <Link
                        href={`/internships/${String(item.slug ?? "")}`}
                        className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                      >
                        View details
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    );
  }

  const applicationsCount = await db
    .collection("applications")
    .countDocuments({ studentId: user._id });
  const myApplications = await db
    .collection("applications")
    .find({ studentId: user._id })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(20)
    .toArray();
  const myInternshipIds = myApplications
    .map((item) => item.internshipId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const myInternships = myInternshipIds.length
    ? await db
        .collection("internships")
        .find({ _id: { $in: myInternshipIds } })
        .project({ _id: 1, title: 1, slug: 1 })
        .toArray()
    : [];
  const myInternshipMap = new Map(myInternships.map((item) => [item._id.toString(), item]));

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Student dashboard</h1>
      <p className="mt-1 text-sm text-slate-600">Welcome, {String(user.name)}.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Applications submitted</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{applicationsCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Next action</p>
          <Link
            href="/"
            className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            Open home feed
          </Link>
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Application status</h2>
        {myApplications.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">You have not applied yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {myApplications.map((application) => {
              const internship = myInternshipMap.get(application.internshipId.toString());
              const status = String(application.status ?? "pending");
              const canReapplyAt =
                status === "rejected" && application.rejectedAt
                  ? new Date(
                      new Date(application.rejectedAt).getTime() + 24 * 60 * 60 * 1000
                    )
                  : null;
              return (
                <article
                  key={application._id.toString()}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {String(internship?.title ?? "Internship")}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-slate-600">
                        Status: {status}
                      </p>
                      {canReapplyAt ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Reapply available after: {canReapplyAt.toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                    {internship?.slug ? (
                      <Link
                        href={`/internships/${String(internship.slug)}`}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                      >
                        View
                      </Link>
                    ) : null}
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
