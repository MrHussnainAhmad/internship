import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.email) return null;

  const db = await getDb();
  return db.collection("users").findOne(
    { email: session.user.email },
    {
      projection: {
        _id: 1,
        email: 1,
        name: 1,
        username: 1,
        role: 1,
        image: 1,
      },
    }
  );
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/signin");
  return user;
}

export function toObjectId(value: string) {
  return new ObjectId(value);
}
