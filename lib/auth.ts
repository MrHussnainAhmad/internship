import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { ensureIndexes } from "@/lib/indexes";
import { requireEnv } from "@/lib/env";

const isDevAuthBypassEnabled =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

type AuthRole = "student" | "company";

const devUserByRole: Record<AuthRole, { email: string; name: string; username: string }> = {
  student: {
    email: "dev-student@internhub.local",
    name: "Dev Student",
    username: "dev_student",
  },
  company: {
    email: "dev-company@internhub.local",
    name: "Dev Company",
    username: "dev_company",
  },
};

function parseAuthRole(value: unknown): AuthRole | null {
  return value === "student" || value === "company" ? value : null;
}

function getGooglePicture(profile: unknown): string {
  if (!profile || typeof profile !== "object") return "";
  const maybePicture = (profile as { picture?: unknown }).picture;
  return typeof maybePicture === "string" ? maybePicture : "";
}

export const authOptions: NextAuthOptions = {
  secret: requireEnv("AUTH_SECRET"),
  session: {
    strategy: "jwt",
  },
  providers: (() => {
    const providers: NextAuthOptions["providers"] = [
      GoogleProvider({
        clientId: requireEnv("GOOGLE_CLIENT_ID"),
        clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
      }),
    ];

    if (!isDevAuthBypassEnabled) return providers;

    providers.push(
      CredentialsProvider({
        id: "credentials",
        name: "Dev Auth Bypass",
        credentials: {
          role: { label: "Role", type: "text" },
        },
        async authorize(credentials) {
          // DEV ONLY - remove after real auth integration.
          if (!isDevAuthBypassEnabled) return null;

          const role = parseAuthRole(credentials?.role);
          if (!role) return null;

          await ensureIndexes();
          const db = await getDb();
          const users = db.collection("users");
          const now = new Date();
          const devUser = devUserByRole[role];

          await users.updateOne(
            { email: devUser.email },
            {
              $set: {
                email: devUser.email,
                name: devUser.name,
                username: devUser.username,
                role,
                image: "",
                provider: "dev-bypass",
                updatedAt: now,
              },
              $setOnInsert: { createdAt: now },
            },
            { upsert: true }
          );

          const dbUser = await users.findOne(
            { email: devUser.email },
            { projection: { _id: 1, email: 1, name: 1, image: 1 } }
          );

          if (!dbUser) return null;

          return {
            id: (dbUser._id as ObjectId).toString(),
            email: String(dbUser.email),
            name: String(dbUser.name ?? devUser.name),
            image: String(dbUser.image ?? ""),
          };
        },
      })
    );

    return providers;
  })(),
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") {
        // DEV ONLY - remove after real auth integration.
        return isDevAuthBypassEnabled;
      }

      if (!user.email || account?.provider !== "google") return false;
      await ensureIndexes();

      const db = await getDb();
      const users = db.collection("users");
      const imageFromGoogle = user.image ?? getGooglePicture(profile);
      await users.updateOne(
        { email: user.email },
        {
          $set: {
            email: user.email,
            name: user.name ?? "",
            image: imageFromGoogle ?? "",
            provider: "google",
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
      return true;
    },
    async jwt({ token, user, account, profile }) {
      const email = user?.email ?? token.email;
      if (!email) return token;

      const db = await getDb();
      const imageFromProvider =
        user?.image ??
        (typeof token.picture === "string" ? token.picture : "") ??
        "";
      const imageFromGoogleProfile =
        account?.provider === "google" ? getGooglePicture(profile) : "";

      const dbUser = await db.collection("users").findOne(
        { email },
        {
          projection: {
            _id: 1,
            role: 1,
            username: 1,
            name: 1,
            email: 1,
            image: 1,
          },
        }
      );

      if (dbUser) {
        const dbImage = String(dbUser.image ?? "");
        const fallbackImage = imageFromProvider || imageFromGoogleProfile || "";
        if (!dbImage && fallbackImage) {
          await db.collection("users").updateOne(
            { _id: dbUser._id },
            { $set: { image: fallbackImage, updatedAt: new Date() } }
          );
        }

        const role =
          dbUser.role === "student" || dbUser.role === "company"
            ? dbUser.role
            : undefined;
        token.sub = (dbUser._id as ObjectId).toString();
        token.role = role;
        token.username = dbUser.username ? String(dbUser.username) : undefined;
        token.name = String(dbUser.name ?? token.name ?? "");
        token.email = String(dbUser.email ?? token.email ?? "");
        token.picture = dbImage || fallbackImage || "";
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role;
        session.user.username = token.username as string | undefined;
        session.user.name = token.name ?? "";
        session.user.email = token.email ?? "";
        session.user.image = token.picture ?? null;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // 1. Allow Expo Go local development deep links
      if (url.startsWith("exp://")) {
        return url;
      }
      // 2. Allow the production React Native app deep links
      if (url.startsWith("internshipapp://")) {
        return url;
      }
      // 3. Keep the default NextAuth security for web
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      } else if (new URL(url).origin === baseUrl) {
        return url;
      }
      return baseUrl;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}
