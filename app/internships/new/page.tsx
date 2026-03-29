import { redirect } from "next/navigation";
import { PostInternshipForm } from "@/components/post-internship-form";
import { requireCurrentUser } from "@/lib/current-user";

export default async function NewInternshipPage() {
  const user = await requireCurrentUser();
  if (!user.username || !user.role) {
    redirect("/onboarding");
  }
  if (user.role !== "company") {
    redirect("/dashboard");
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Post internship</h1>
      <p className="mb-6 text-sm text-slate-600">
        Keep the listing concise and focused. Description is capped at 300 characters.
      </p>
      <PostInternshipForm />
    </section>
  );
}
