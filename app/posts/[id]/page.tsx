import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { toAbsoluteUrl } from "@/lib/site-url";

type Params = { id: string };

async function getPostById(id: string) {
  if (!ObjectId.isValid(id)) return null;

  const db = await getDb();
  const postId = new ObjectId(id);
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
  const canonical = `/posts/${post.id}`;
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
    <section className="mx-auto w-full max-w-2xl px-4 py-8">
      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-4 border-b border-slate-200 pb-4">
          {post.author.username ? (
            <Link
              href={`/profiles/${post.author.username}`}
              className="text-sm font-semibold text-slate-900 hover:text-blue-700"
            >
              {post.author.name}
            </Link>
          ) : (
            <p className="text-sm font-semibold text-slate-900">{post.author.name}</p>
          )}
          <p className="text-xs text-slate-500">
            {new Date(post.createdAt).toLocaleString()}
          </p>
        </header>

        {post.topic ? (
          <h1 className="text-lg font-semibold text-slate-900">{post.topic}</h1>
        ) : null}
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
          {post.content}
        </p>
      </article>
    </section>
  );
}
