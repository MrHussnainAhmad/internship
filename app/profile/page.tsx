import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";

export default async function ProfilePage() {
  const user = await requireCurrentUser();
  if (!user.username || !user.role) {
    redirect("/onboarding");
  }

  redirect(`/profiles/${String(user.username)}`);
}