import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { DevAuthBypassButtons } from "@/components/dev-auth-bypass-buttons";

const isDevAuthBypassEnabled =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) {
    if (session.user.username && session.user.role) {
      redirect("/");
    }
    redirect("/onboarding");
  }

  return (
    <section className="mx-auto flex w-full max-w-md px-4 py-16">
      <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-slate-900">Welcome back</h1>
        <p className="mb-6 text-sm text-slate-600">
          Sign in with Google to continue to your internship workspace.
        </p>
        <GoogleSignInButton />
        {isDevAuthBypassEnabled ? <DevAuthBypassButtons /> : null}
      </div>
    </section>
  );
}
