import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { verifyMobileAccessToken } from "@/lib/mobile-token";

export type ApiUser = {
  _id: ObjectId;
  email: string;
  name?: string;
  username?: string;
  role?: "student" | "company";
  image?: string;
};

const defaultProjection = {
  _id: 1,
  email: 1,
  name: 1,
  username: 1,
  role: 1,
  image: 1,
} as const;

function readBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
}

async function getWebSessionUser() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const db = await getDb();
  return db
    .collection("users")
    .findOne({ email: session.user.email }, { projection: defaultProjection });
}

async function getMobileTokenUser(request: Request) {
  const bearer = readBearerToken(request);
  if (!bearer) return null;
  const payload = verifyMobileAccessToken(bearer);
  if (!payload || !ObjectId.isValid(payload.sub)) return null;

  const db = await getDb();
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(payload.sub) },
    { projection: defaultProjection }
  );
  if (!user) return null;
  if (String(user.email ?? "").toLowerCase() !== payload.email.toLowerCase()) {
    return null;
  }
  return user;
}

export async function getApiUser(request: Request): Promise<ApiUser | null> {
  const webUser = await getWebSessionUser();
  if (webUser) return webUser as ApiUser;
  const mobileUser = await getMobileTokenUser(request);
  if (mobileUser) return mobileUser as ApiUser;
  return null;
}

