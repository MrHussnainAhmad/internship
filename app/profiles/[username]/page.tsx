import Link from "next/link";
import Image from "next/image";
import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getProfileByUsername } from "@/lib/profile-data";
import { ConnectButton } from "@/components/connect-button";
import { StudentPostComposer } from "@/components/student-post-composer";
import { FollowersFollowingPopup } from "@/components/followers-following-popup";

export default async function PublicProfilePage(props: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await props.params;
  const session = await auth();
  const viewerId = session?.user?.id;
  const profile = await getProfileByUsername({ username, viewerUserId: viewerId });
  if (!profile) notFound();

  const isSelf = viewerId === profile.user.id;
  if (viewerId && !isSelf && ObjectId.isValid(profile.user.id) && ObjectId.isValid(viewerId)) {
    const db = await getDb();
    await db.collection("profileViews").insertOne({
      targetUserId: new ObjectId(profile.user.id),
      viewerUserId: new ObjectId(viewerId),
      createdAt: new Date(),
    });
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {profile.user.image ? (
              <Image
                src={profile.user.image}
                alt={profile.user.name}
                width={72}
                height={72}
                className="h-[72px] w-[72px] rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <span className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xl font-semibold text-slate-700">
                {profile.user.name ? profile.user.name.charAt(0).toUpperCase() : "?"}
              </span>
            )}
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{profile.user.name}</h1>
              <p className="mt-1 text-sm text-slate-600">
                @{profile.user.username} ({profile.user.role})
              </p>
            </div>
          </div>
          {isSelf ? (
            <Link
              href="/onboarding"
              className="text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              Edit profile
            </Link>
          ) : viewerId ? (
            <ConnectButton
              targetUserId={profile.user.id}
              initialConnected={profile.connected}
              initialFollowersCount={profile.followersCount}
              initialFollowingCount={profile.followingCount}
            />
          ) : null}
        </div>

        {profile.user.role === "student" ? (
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Level</dt>
              <dd className="text-sm text-slate-900">
                {String(profile.studentProfile?.level ?? "-")}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Education</dt>
              <dd className="text-sm text-slate-900">
                {String(profile.studentProfile?.education ?? "-")}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Location</dt>
              <dd className="text-sm text-slate-900">
                {String(profile.studentProfile?.location ?? "-")},{" "}
                {String(profile.studentProfile?.country ?? "-")}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Preferred Type
              </dt>
              <dd className="text-sm text-slate-900">
                {String(profile.studentProfile?.preferredType ?? "-").replaceAll("_", " ")}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Skills</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {(profile.studentProfile?.skills ?? []).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                  >
                    {skill}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        ) : (
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Company</dt>
              <dd className="text-sm text-slate-900">
                {String(profile.companyProfile?.companyName ?? "-")}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Industry</dt>
              <dd className="text-sm text-slate-900">
                {String(profile.companyProfile?.industry ?? "-")}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Location</dt>
              <dd className="text-sm text-slate-900">
                {String(profile.companyProfile?.location ?? "-")},{" "}
                {String(profile.companyProfile?.country ?? "-")}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Remote</dt>
              <dd className="text-sm text-slate-900">
                {profile.companyProfile?.isRemote ? "Yes" : "No"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Description</dt>
              <dd className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {String(profile.companyProfile?.description ?? "-")}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {isSelf && profile.user.role === "student" ? (
        <div className="mt-6">
          <StudentPostComposer />
        </div>
      ) : null}

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Posts</h2>
        <FollowersFollowingPopup
          followers={profile.followers}
          following={profile.following}
          followersCount={profile.followersCount}
          followingCount={profile.followingCount}
        />

        {profile.posts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No posts yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {profile.posts.map((post) => (
              <article key={post.id} className="rounded-lg border border-slate-200 p-4">
                {post.topic ? (
                  <p className="text-sm font-semibold text-slate-900">{post.topic}</p>
                ) : null}
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {post.content}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {new Date(post.createdAt).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
