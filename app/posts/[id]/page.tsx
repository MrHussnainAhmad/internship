import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { toObjectIdFromPublicPostId, toPublicPostId } from "@/lib/post-id";
import { toAbsoluteUrl } from "@/lib/site-url";

type Params = { id: string };

async function getPostById(id: string) {
  const resolvedId = toObjectIdFromPublicPostId(id);
  if (!resolvedId || !ObjectId.isValid(resolvedId)) return null;

  const db = await getDb();
  const postId = new ObjectId(resolvedId);
  const post = await db.collection("posts").findOne(
    { _id: postId },
    { projection: { _id: 1, authorId: 1, topic: 1, content: 1, createdAt: 1 } }
  );
  if (!post) return null;

  const author = post.authorId
    ? await db
        .collection("users")
        .findOne(
          { _id: post.authorId },
          { projection: { _id: 1, name: 1, username: 1, image: 1 } }
        )
    : null;

  return {
    id: post._id.toString(),
    publicId: toPublicPostId(post._id.toString()),
    topic: String(post.topic ?? ""),
    content: String(post.content ?? ""),
    createdAt: new Date(post.createdAt ?? Date.now()).toISOString(),
    author: {
      id: author?._id?.toString() ?? "",
      name: String(author?.name ?? "User"),
      username: String(author?.username ?? ""),
      image: String(author?.image ?? ""),
    },
  };
}

function clip(value: string, max: number) {
  if (value.length <= max) return value;
  if (max <= 3) return value.slice(0, max);
  return `${value.slice(0, max - 3)}...`;
}

export async function generateMetadata(props: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const post = await getPostById(id);

  if (!post) return { title: "Post not found" };

  const title = post.topic
    ? `${post.topic} - @${post.author.username || "user"}`
    : `Post by ${post.author.name}`;
  const description = clip(post.content, 220);
  const canonical = `/posts/${post.publicId}`;
  const imageUrl = post.author.image || undefined;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      images: imageUrl
        ? [{ url: toAbsoluteUrl(imageUrl), width: 400, height: 400 }]
        : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [toAbsoluteUrl(imageUrl)] : undefined,
    },
  };
}

export default async function PostDetailPage(props: {
  params: Promise<Params>;
}) {
  const { id } = await props.params;
  const post = await getPostById(id);
  if (!post) notFound();

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8 md:py-10">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <header className="border-b border-slate-200 pb-4">
          {post.author.username ? (
            <Link
              href={`/profiles/${post.author.username}`}
              className="text-sm font-semibold text-slate-900 transition hover:text-slate-700"
            >
              {post.author.name}
            </Link>
          ) : (
            <p className="text-sm font-semibold text-slate-900">{post.author.name}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            {new Date(post.createdAt).toLocaleString()}
          </p>
        </header>

        {post.topic ? (
          <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-slate-900">
            {post.topic}
          </h1>
        ) : null}

        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
          {post.content}
        </p>
      </article>
    </section>
  );
}