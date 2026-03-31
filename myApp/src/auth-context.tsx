import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { useRouter } from "expo-router";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { APP_STORAGE_KEYS, GOOGLE_CLIENT_IDS } from "./config";
import {
  exchangeGoogleIdToken,
  getCompanyProfile,
  getCoreProfile,
  getStudentProfile,
  updateCompanyProfile,
  updateCoreProfile,
  updateStudentProfile,
} from "./api";
import type { CompanyProfile, StudentProfile, UserProfile, UserRole } from "./types";

type OnboardingInput = {
  name: string;
  username?: string;
  bio?: string;
  role: UserRole;
  studentProfile?: StudentProfile;
  companyProfile?: CompanyProfile;
};

type AuthContextValue = {
  ready: boolean;
  loading: boolean;
  token: string | null;
  user: UserProfile | null;
  role: UserRole | null;
  studentProfile: StudentProfile | null;
  companyProfile: CompanyProfile | null;
  needsOnboarding: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  updateCore: (body: { name: string; bio?: string; image?: string }) => Promise<void>;
  updateStudent: (body: StudentProfile) => Promise<void>;
  updateCompany: (body: CompanyProfile) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function profileHasBasics(user: UserProfile | null) {
  if (!user) return false;
  return Boolean(user.name?.trim() && user.username?.trim() && user.role);
}

function studentProfileComplete(profile: StudentProfile | null) {
  if (!profile) return false;
  return Boolean(
    profile.skills?.length &&
      profile.languages?.length &&
      profile.level &&
      profile.education?.trim() &&
      profile.location?.trim() &&
      profile.country?.trim() &&
      profile.preferredType &&
      profile.resumeUrl?.trim()
  );
}

function companyProfileComplete(profile: CompanyProfile | null) {
  if (!profile) return false;
  return Boolean(
    profile.companyName?.trim() &&
      profile.industry?.trim() &&
      profile.location?.trim() &&
      profile.country?.trim() &&
      profile.description?.trim().length >= 10
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const router = useRouter();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_CLIENT_IDS.webClientId,
      iosClientId: GOOGLE_CLIENT_IDS.iosClientId || undefined,
      scopes: ["email", "profile"],
      forceCodeForRefreshToken: false,
    });
  }, []);

  const refreshSession = async () => {
    const currentToken = (await AsyncStorage.getItem(APP_STORAGE_KEYS.token)) || null;
    if (!currentToken) {
      setToken(null);
      setUser(null);
      setStudentProfile(null);
      setCompanyProfile(null);
      return;
    }

    setToken(currentToken);
    const core = await getCoreProfile(currentToken);
    setUser(core.user);

    if (core.user.role === "student") {
      const student = await getStudentProfile(currentToken);
      setStudentProfile(student.profile);
      setCompanyProfile(null);
    } else if (core.user.role === "company") {
      const company = await getCompanyProfile(currentToken);
      setCompanyProfile(company.profile);
      setStudentProfile(null);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await refreshSession();
      } catch {
        await AsyncStorage.removeItem(APP_STORAGE_KEYS.token);
        setToken(null);
        setUser(null);
        setStudentProfile(null);
        setCompanyProfile(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      if (!GOOGLE_CLIENT_IDS.webClientId) {
        throw new Error(
          "Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile app build environment."
        );
      }
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      let idToken =
        ("data" in result ? result.data?.idToken : undefined) ||
        ("idToken" in result ? result.idToken : undefined);

      // Some Android builds don't return idToken from signIn() directly.
      // Fallback to getTokens() after a successful account selection.
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens().catch(() => null);
        idToken = tokens?.idToken ?? undefined;
      }

      if (!idToken) {
        throw new Error(
          "Google sign-in did not return an idToken. Check webClientId in app build env and Google OAuth setup."
        );
      }

      const response = await exchangeGoogleIdToken(String(idToken));
      await AsyncStorage.setItem(APP_STORAGE_KEYS.token, response.token);
      await refreshSession();
      router.replace("/");
    } catch (error) {
      await AsyncStorage.removeItem(APP_STORAGE_KEYS.token);
      setToken(null);
      setUser(null);
      setStudentProfile(null);
      setCompanyProfile(null);
      const message = error instanceof Error ? error.message : "Google sign-in failed.";
      Alert.alert(
        "Login failed",
        `${message}\n\nIf this is Android, verify GOOGLE_ANDROID_CLIENT_ID is set in Vercel production environment and redeploy.`
      );
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await AsyncStorage.removeItem(APP_STORAGE_KEYS.token);
      await GoogleSignin.signOut().catch(() => null);
      setToken(null);
      setUser(null);
      setStudentProfile(null);
      setCompanyProfile(null);
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async (input: OnboardingInput) => {
    if (!token) throw new Error("No token");
    setLoading(true);
    try {
      await updateCoreProfile(token, {
        name: input.name,
        role: input.role,
        username: input.username,
        bio: input.bio,
      });

      if (input.role === "student") {
        if (!input.studentProfile) throw new Error("Missing student profile payload");
        await updateStudentProfile(token, input.studentProfile);
      } else {
        if (!input.companyProfile) throw new Error("Missing company profile payload");
        await updateCompanyProfile(token, input.companyProfile);
      }

      await refreshSession();
      router.replace("/");
    } finally {
      setLoading(false);
    }
  };

  const updateStudent = async (body: StudentProfile) => {
    if (!token) return;
    setLoading(true);
    try {
      await updateStudentProfile(token, body);
      const latest = await getStudentProfile(token);
      setStudentProfile(latest.profile);
    } finally {
      setLoading(false);
    }
  };

  const updateCore = async (body: { name: string; bio?: string; image?: string }) => {
    if (!token || !user?.role) return;
    setLoading(true);
    try {
      await updateCoreProfile(token, {
        name: body.name,
        role: user.role,
        bio: body.bio,
        image: body.image,
      });
      const latest = await getCoreProfile(token);
      setUser(latest.user);
    } finally {
      setLoading(false);
    }
  };

  const updateCompany = async (body: CompanyProfile) => {
    if (!token) return;
    setLoading(true);
    try {
      await updateCompanyProfile(token, body);
      const latest = await getCompanyProfile(token);
      setCompanyProfile(latest.profile);
    } finally {
      setLoading(false);
    }
  };

  const role = user?.role ?? null;
  const needsOnboarding = useMemo(() => {
    if (!profileHasBasics(user)) return true;
    if (role === "student") return !studentProfileComplete(studentProfile);
    if (role === "company") return !companyProfileComplete(companyProfile);
    return true;
  }, [companyProfile, role, studentProfile, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      loading,
      token,
      user,
      role,
      studentProfile,
      companyProfile,
      needsOnboarding,
      signInWithGoogle,
      signOut,
      refreshSession,
      completeOnboarding,
      updateCore,
      updateStudent,
      updateCompany,
    }),
    [ready, loading, token, user, role, studentProfile, companyProfile, needsOnboarding]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
