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
  const [role, setRole] = useState<Role>("student");
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
        setUsername(profileJson.user?.username ?? "");
        if (profileJson.user?.role === "company") setRole("company");

        if (profileJson.user?.role === "company") {
          const cRes = await fetch("/api/company");
          const cJson = await cRes.json();
          if (cJson.profile) {
            setCompany({
              companyName: cJson.profile.companyName ?? "",
              industry: cJson.profile.industry ?? "",
              location: cJson.profile.location ?? "",
              country: cJson.profile.country ?? "Pakistan",
              isRemote: Boolean(cJson.profile.isRemote),
              description: cJson.profile.description ?? "",
            });
          }
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
          body: JSON.stringify({ name, username, role }),
        });
        const profileData = await profileRes.json();
        if (!profileRes.ok) {
          setMessage(profileData.error ?? "Could not save basic profile");
          return;
        }

        if (role === "student") {
          const uploadedResumeUrl = await uploadResume();
          const payload = {
            ...student,
            resumeUrl: uploadedResumeUrl || student.resumeUrl,
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
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            className="rounded-md border border-slate-300 px-3 py-2"
            required
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Role
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
          className="rounded-md border border-slate-300 px-3 py-2"
        >
          <option value="student">Student</option>
          <option value="company">Company</option>
        </select>
      </label>

      {role === "student" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Skills (comma separated)
            <input
              value={student.skills}
              onChange={(event) =>
                setStudent((prev) => ({ ...prev, skills: event.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Level
            <select
              value={student.level}
              onChange={(event) =>
                setStudent((prev) => ({ ...prev, level: event.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Preferred Type
            <select
              value={student.preferredType}
              onChange={(event) =>
                setStudent((prev) => ({ ...prev, preferredType: event.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="learn_and_earn">Learn and Earn</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Education
            <input
              value={student.education}
              onChange={(event) =>
                setStudent((prev) => ({ ...prev, education: event.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            City
            <input
              value={student.location}
              onChange={(event) =>
                setStudent((prev) => ({ ...prev, location: event.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Country
            <input
              value={student.country}
              onChange={(event) =>
                setStudent((prev) => ({ ...prev, country: event.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Languages (comma separated)
            <input
              value={student.languages}
              onChange={(event) =>
                setStudent((prev) => ({ ...prev, languages: event.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            GPA (optional)
            <input
              value={student.gpa}
              onChange={(event) =>
                setStudent((prev) => ({ ...prev, gpa: event.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Resume (optional PDF, max 300KB)
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
            {student.resumeUrl ? (
              <a
                href={student.resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-blue-700 hover:text-blue-900"
              >
                View current resume
              </a>
            ) : null}
          </label>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Company Name
            <input
              value={company.companyName}
              onChange={(event) =>
                setCompany((prev) => ({ ...prev, companyName: event.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Industry
            <input
              value={company.industry}
              onChange={(event) =>
                setCompany((prev) => ({ ...prev, industry: event.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            City
            <input
              value={company.location}
              onChange={(event) =>
                setCompany((prev) => ({ ...prev, location: event.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Country
            <input
              value={company.country}
              onChange={(event) =>
                setCompany((prev) => ({ ...prev, country: event.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={company.isRemote}
              onChange={(event) =>
                setCompany((prev) => ({ ...prev, isRemote: event.target.checked }))
              }
            />
            Remote friendly
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Description (max 200 chars)
            <textarea
              value={company.description}
              onChange={(event) =>
                setCompany((prev) => ({ ...prev, description: event.target.value }))
              }
              className="min-h-28 rounded-md border border-slate-300 px-3 py-2"
              required
              maxLength={200}
            />
          </label>
        </div>
      )}

      {message ? <p className="text-sm text-red-600">{message}</p> : null}
      <button
        type="submit"
        title={saving ? "Saving" : "Save and continue"}
        aria-label={saving ? "Saving" : "Save and continue"}
        disabled={saving}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white disabled:opacity-60"
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
        <span className="sr-only">{saving ? "Saving" : "Save and continue"}</span>
      </button>
    </form>
  );
}
