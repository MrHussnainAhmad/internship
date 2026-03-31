import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";
import { CompanyVerificationForm } from "@/components/company-verification-form";

export default async function CompanyVerifyPage() {
  const user = await requireCurrentUser();
  if (!user.username || !user.role) {
    redirect("/onboarding");
  }
  if (user.role !== "company") {
    redirect("/profile");
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8 md:py-10">
      <CompanyVerificationForm />
    </section>
  );
}