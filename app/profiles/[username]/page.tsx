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
import { VerifiedBadge } from "@/components/verified-badge";
import { SocialIconLinks } from "@/components/social-icon-links";

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
    <section className="mx-auto w-full max-w-4xl px-4 py-8 md:py-10">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              {profile.user.image ? (
                <Image
                  src={profile.user.image}
                  alt={profile.user.name}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <span className="inline-flex h-20 w-20 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl font-semibold text-slate-700">
                  {profile.user.name ? profile.user.name.charAt(0).toUpperCase() : "?"}
                </span>
              )}

              <div className="min-w-0">
                <h1 className="truncate text-[28px] font-semibold tracking-[-0.03em] text-slate-900">
                  {profile.user.name}
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  @{profile.user.username} · {profile.user.role}
                </p>

                {profile.user.role === "company" && profile.companyProfile?.verified ? (
                  <div className="mt-2">
                    <VerifiedBadge />
                  </div>
                ) : null}

                {profile.user.bio ? (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
                    {profile.user.bio}
                  </p>
                ) : null}
              </div>
            </div>

            {isSelf ? (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/onboarding?edit=1"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Edit profile
                </Link>

                {profile.user.role === "company" && !profile.companyProfile?.verified ? (
                  <Link
                    href="/company/verify"
                    className="inline-flex h-10 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Get verified
                  </Link>
                ) : null}
              </div>
            ) : viewerId ? (
              <ConnectButton
                targetUserId={profile.user.id}
                initialConnected={profile.connected}
                initialFollowersCount={profile.followersCount}
                initialFollowingCount={profile.followingCount}
              />
            ) : null}
          </div>
        </div>

        <div className="px-6 py-6">
          {profile.user.role === "student" ? (
            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Level</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {String(profile.studentProfile?.level ?? "-")}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Education</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {String(profile.studentProfile?.education ?? "-")}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Location</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {String(profile.studentProfile?.location ?? "-")},{" "}
                  {String(profile.studentProfile?.country ?? "-")}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Preferred type
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {String(profile.studentProfile?.preferredType ?? "-").replaceAll("_", " ")}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Skills</dt>
                <dd className="mt-3 flex flex-wrap gap-2">
                  {(profile.studentProfile?.skills ?? []).map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {skill}
                    </span>
                  ))}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Links</dt>
                <dd className="mt-3 flex flex-wrap gap-3 text-sm">
                  {profile.studentProfile?.portfolioUrl ? (
                    <a
                      href={profile.studentProfile.portfolioUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                    >
                      Portfolio
                    </a>
                  ) : null}
                  {profile.studentProfile?.linkedinUrl ? (
                    <a
                      href={profile.studentProfile.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                    >
                      LinkedIn
                    </a>
                  ) : null}
                  {profile.studentProfile?.twitterUrl ? (
                    <a
                      href={profile.studentProfile.twitterUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                    >
                      Twitter
                    </a>
                  ) : null}
                  {profile.studentProfile?.instagramUrl ? (
                    <a
                      href={profile.studentProfile.instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                    >
                      Instagram
                    </a>
                  ) : null}
                  {!profile.studentProfile?.portfolioUrl &&
                  !profile.studentProfile?.linkedinUrl &&
                  !profile.studentProfile?.twitterUrl &&
                  !profile.studentProfile?.instagramUrl ? (
                    <span className="text-slate-500">-</span>
                  ) : null}
                </dd>
              </div>
            </dl>
          ) : (
            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Company</dt>
                <dd className="mt-1 flex items-center gap-2 text-sm text-slate-900">
                  <span>{String(profile.companyProfile?.companyName ?? "-")}</span>
                  {profile.companyProfile?.verified ? <VerifiedBadge trustedLabel={false} /> : null}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Industry</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {String(profile.companyProfile?.industry ?? "-")}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Location</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {String(profile.companyProfile?.location ?? "-")},{" "}
                  {String(profile.companyProfile?.country ?? "-")}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Remote</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {profile.companyProfile?.isRemote ? "Yes" : "No"}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Description</dt>
                <dd className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {String(profile.companyProfile?.description ?? "-")}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Links</dt>
                <dd className="mt-3">
                  {profile.companyProfile?.verified ? (
                    <SocialIconLinks
                      websiteUrl={profile.companyProfile.websiteUrl}
                      linkedinUrl={profile.companyProfile.linkedinUrl}
                      twitterUrl={profile.companyProfile.twitterUrl}
                      instagramUrl={profile.companyProfile.instagramUrl}
                    />
                  ) : (
                    <span className="text-sm text-slate-500">
                      Links are shown after company verification.
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      {isSelf && profile.user.role === "student" ? (
        <div className="mt-6">
          <StudentPostComposer />
        </div>
      ) : null}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Posts</h2>
            <p className="mt-1 text-sm text-slate-600">Recent updates from this profile.</p>
          </div>

          <FollowersFollowingPopup
            followers={profile.followers}
            following={profile.following}
            followersCount={profile.followersCount}
            followingCount={profile.followingCount}
          />
        </div>

        {profile.posts.length === 0 ? (
          <p className="mt-5 text-sm text-slate-600">No posts yet.</p>
        ) : (
          <div className="mt-5 space-y-3">
            {profile.posts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-slate-200 p-4">
                {post.topic ? (
                  <p className="text-sm font-semibold text-slate-900">{post.topic}</p>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {post.content}
                </p>
                <p className="mt-3 text-xs text-slate-500">
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