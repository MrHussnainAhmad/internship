import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getInternshipBySlug } from "@/lib/internships";
import { EditInternshipForm } from "@/components/edit-internship-form";

export default async function EditInternshipPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "company") {
    redirect("/auth/signin");
  }

  const { slug } = await props.params;
  const internship = await getInternshipBySlug(slug);
  if (!internship) {
    redirect("/internships");
  }

  if (session.user.id !== internship.companyId) {
    redirect(`/internships/${slug}`);
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-slate-900">
          Edit internship
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Update your listing details. Description remains capped at 300 characters.
        </p>
      </div>

      <EditInternshipForm
        slug={internship.slug}
        initial={{
          title: internship.title,
          skillsRequired: internship.skillsRequired,
          level: internship.level,
          type: internship.type,
          isPaid: internship.isPaid,
          location: internship.location,
          country: internship.country,
          isRemote: internship.isRemote,
          duration: internship.duration,
          resumeRequired: internship.resumeRequired,
          description: internship.description,
          imageUrl: internship.imageUrl,
        }}
      />
    </section>
  );
}