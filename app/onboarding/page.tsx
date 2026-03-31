import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { requireCurrentUser } from "@/lib/current-user";

export default async function OnboardingPage(props: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requireCurrentUser();
  const searchParams = await props.searchParams;
  const isEditMode = searchParams.edit === "1";

  if (user.username && user.role && !isEditMode) {
    redirect("/");
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-slate-900">
          {isEditMode ? "Edit your profile" : "Complete your profile"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {isEditMode
            ? "Update your role and profile details."
            : "Set your role and profile details to unlock personalized internships and workflows."}
        </p>
      </div>

      <OnboardingForm />
    </section>
  );
}