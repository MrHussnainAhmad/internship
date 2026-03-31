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
    <section className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-md items-center px-4 py-12">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-slate-900">
            Welcome back
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in with Google to continue to your internship workspace.
          </p>
        </div>

        <div className="mt-6">
          <GoogleSignInButton />
        </div>

        {isDevAuthBypassEnabled ? <DevAuthBypassButtons /> : null}
      </div>
    </section>
  );
}