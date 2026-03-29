import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { requireCurrentUser } from "@/lib/current-user";

export default async function OnboardingPage() {
  const user = await requireCurrentUser();
  if (user.username && user.role) {
    redirect("/");
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Complete your profile</h1>
      <p className="mb-6 text-sm text-slate-600">
        Set your role and profile details to unlock personalized internships and workflows.
      </p>
      <OnboardingForm />
    </section>
  );
}
