"use client";

import { FormEvent, useEffect, useState, startTransition } from "react";

type Role = "student" | "company";

const defaultStudent = {
  skills: "",
  level: "beginner",
  education: "",
  gpa: "",
  languages: "",
  location: "",
  country: "Pakistan",
  preferredType: "paid",
  resumeUrl: "",
  portfolioUrl: "",
  linkedinUrl: "",
  twitterUrl: "",
  instagramUrl: "",
};

const defaultCompany = {
  companyName: "",
  industry: "",
  location: "",
  country: "Pakistan",
  isRemote: false,
  description: "",
};

export function OnboardingForm() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [isUsernameLocked, setIsUsernameLocked] = useState(false);
  const [isRoleLocked, setIsRoleLocked] = useState(false);
  const [student, setStudent] = useState(defaultStudent);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [company, setCompany] = useState(defaultCompany);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function uploadResume() {
    if (!resumeFile) return "";
    const formData = new FormData();
    formData.append("file", resumeFile);
    formData.append("kind", "pdf");
    const response = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Resume upload failed");
    }
    return String(data.url ?? "");
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const profileRes = await fetch("/api/profile");
        if (!profileRes.ok) return;
        const profileJson = await profileRes.json();
        if (!active) return;

        setName(profileJson.user?.name ?? "");
        setBio(profileJson.user?.bio ?? "");
        const existingUsername = String(profileJson.user?.username ?? "").trim();
        const existingRole = profileJson.user?.role;
        setUsername(existingUsername);
        setIsUsernameLocked(Boolean(existingUsername));
        if (existingRole === "student" || existingRole === "company") {
          setRole(existingRole);
          setIsRoleLocked(true);
        }

        const cRes = await fetch("/api/company");
        const cJson = await cRes.json();
        const hasCompanyProfile = Boolean(cJson.profile);

        if ((existingRole === "company" || !existingRole) && hasCompanyProfile) {
          setRole("company");
          setIsRoleLocked(true);
          setCompany({
            companyName: cJson.profile.companyName ?? "",
            industry: cJson.profile.industry ?? "",
            location: cJson.profile.location ?? "",
            country: cJson.profile.country ?? "Pakistan",
            isRemote: Boolean(cJson.profile.isRemote),
            description: cJson.profile.description ?? "",
          });
        } else {
          const sRes = await fetch("/api/student");
          const sJson = await sRes.json();
          if (sJson.profile) {
            setStudent({
              skills: (sJson.profile.skills ?? []).join(", "),
              level: sJson.profile.level ?? "beginner",
              education: sJson.profile.education ?? "",
              gpa: sJson.profile.gpa ?? "",
              languages: (sJson.profile.languages ?? []).join(", "),
              location: sJson.profile.location ?? "",
              country: sJson.profile.country ?? "Pakistan",
              preferredType: sJson.profile.preferredType ?? "paid",
              resumeUrl: sJson.profile.resumeUrl ?? "",
              portfolioUrl: sJson.profile.portfolioUrl ?? "",
              linkedinUrl: sJson.profile.linkedinUrl ?? "",
              twitterUrl: sJson.profile.twitterUrl ?? "",
              instagramUrl: sJson.profile.instagramUrl ?? "",
            });
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    startTransition(async () => {
      try {
        const profileRes = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, username, bio, role }),
        });
        const profileData = await profileRes.json();
        if (!profileRes.ok) {
          setMessage(profileData.error ?? "Could not save basic profile");
          return;
        }

        if (role === "student") {
          const studentLinkCount = [
            student.portfolioUrl,
            student.linkedinUrl,
            student.twitterUrl,
            student.instagramUrl,
          ].filter((value) => value.trim()).length;
          if (studentLinkCount > 3) {
            setMessage("Students can add at most 3 links.");
            return;
          }

          if (!resumeFile && !student.resumeUrl) {
            setMessage("Resume is required for student profile. Please upload a PDF (max 130KB).");
            return;
          }

          const uploadedResumeUrl = await uploadResume();
          const resumeUrl = uploadedResumeUrl || student.resumeUrl;
          if (!resumeUrl) {
            setMessage("Resume is required for student profile. Please upload a PDF (max 130KB).");
            return;
          }

          const payload = {
            ...student,
            resumeUrl,
            skills: student.skills
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
            languages: student.languages
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          };
          const res = await fetch("/api/student", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) {
            setMessage(data.error ?? "Could not save student profile");
            return;
          }
          if (uploadedResumeUrl) {
            setStudent((prev) => ({ ...prev, resumeUrl: uploadedResumeUrl }));
            setResumeFile(null);
          }
        } else {
          const res = await fetch("/api/company", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(company),
          });
          const data = await res.json();
          if (!res.ok) {
            setMessage(data.error ?? "Could not save company profile");
            return;
          }
        }

        window.location.href = "/";
      } catch {
        setMessage("Something went wrong while saving profile.");
      } finally {
        setSaving(false);
      }
    });
  };

  if (loading) {
    return <p className="text-sm text-slate-600">Loading profile...</p>;
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
    >
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">
          Complete your profile
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Set up your account details to start using InternHub.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-800">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              required
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-800">Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              disabled={isUsernameLocked}
              required
            />
            {isUsernameLocked ? (
              <span className="text-xs text-slate-500">Username is locked after first setup.</span>
            ) : null}
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-800">Bio</span>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            className="min-h-24 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            maxLength={100}
            placeholder="Write a short bio"
          />
          <span className="text-xs text-slate-500">{bio.length}/100</span>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-800">Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
            disabled={isRoleLocked}
          >
            <option value="student">Student</option>
            <option value="company">Company</option>
          </select>
          {isRoleLocked ? (
            <span className="text-xs text-slate-500">Role is locked after first setup.</span>
          ) : null}
        </label>

        {role === "student" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-slate-800">Skills</span>
              <input
                value={student.skills}
                onChange={(event) =>
                  setStudent((prev) => ({ ...prev, skills: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-800">Level</span>
              <select
                value={student.level}
                onChange={(event) =>
                  setStudent((prev) => ({ ...prev, level: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-800">Preferred type</span>
              <select
                value={student.preferredType}
                onChange={(event) =>
                  setStudent((prev) => ({ ...prev, preferredType: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              >
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="learn_and_earn">Learn and Earn</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-slate-800">Education</span>
              <input
                value={student.education}
                onChange={(event) =>
                  setStudent((prev) => ({ ...prev, education: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-800">City</span>
              <input
                value={student.location}
                onChange={(event) =>
                  setStudent((prev) => ({ ...prev, location: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-800">Country</span>
              <input
                value={student.country}
                onChange={(event) =>
                  setStudent((prev) => ({ ...prev, country: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-slate-800">Languages</span>
              <input
                value={student.languages}
                onChange={(event) =>
                  setStudent((prev) => ({ ...prev, languages: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-800">GPA</span>
              <input
                value={student.gpa}
                onChange={(event) =>
                  setStudent((prev) => ({ ...prev, gpa: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-800">Resume</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700"
              />
              {student.resumeUrl ? (
                <a
                  href={student.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                >
                  View current resume
                </a>
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-slate-800">Portfolio URL</span>
              <input
                value={student.portfolioUrl}
                onChange={(event) =>
                  setStudent((prev) => ({ ...prev, portfolioUrl: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                placeholder="https://..."
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-800">LinkedIn URL</span>
              <input
                value={student.linkedinUrl}
                onChange={(event) =>
                  setStudent((prev) => ({ ...prev, linkedinUrl: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                placeholder="https://..."
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-800">Twitter URL</span>
              <input
                value={student.twitterUrl}
                onChange={(event) =>
                  setStudent((prev) => ({ ...prev, twitterUrl: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                placeholder="https://..."
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-slate-800">Instagram URL</span>
              <input
                value={student.instagramUrl}
                onChange={(event) =>
                  setStudent((prev) => ({ ...prev, instagramUrl: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                placeholder="https://..."
              />
            </label>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-slate-800">Company name</span>
              <input
                value={company.companyName}
                onChange={(event) =>
                  setCompany((prev) => ({ ...prev, companyName: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-800">Industry</span>
              <input
                value={company.industry}
                onChange={(event) =>
                  setCompany((prev) => ({ ...prev, industry: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-800">City</span>
              <input
                value={company.location}
                onChange={(event) =>
                  setCompany((prev) => ({ ...prev, location: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-800">Country</span>
              <input
                value={company.country}
                onChange={(event) =>
                  setCompany((prev) => ({ ...prev, country: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                required
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={company.isRemote}
                onChange={(event) =>
                  setCompany((prev) => ({ ...prev, isRemote: event.target.checked }))
                }
                className="h-4 w-4"
              />
              Remote friendly
            </label>

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-slate-800">Description</span>
              <textarea
                value={company.description}
                onChange={(event) =>
                  setCompany((prev) => ({ ...prev, description: event.target.value }))
                }
                className="min-h-32 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                required
                maxLength={200}
              />
            </label>

            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Company links moved to <span className="font-semibold text-slate-900">Get Verified</span>.
              Complete profile first, then verify from your profile page.
            </div>
          </div>
        )}

        {message ? <p className="text-sm text-red-600">{message}</p> : null}

        <div className="flex justify-end border-t border-slate-200 pt-4">
          <button
            type="submit"
            title={saving ? "Saving" : "Save and continue"}
            aria-label={saving ? "Saving" : "Save and continue"}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" className="opacity-30" />
                <path d="M21 12a9 9 0 0 0-9-9" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span>{saving ? "Saving..." : "Save and continue"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}