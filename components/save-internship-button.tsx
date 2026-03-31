"use client";

import { useState } from "react";

type SaveInternshipButtonProps = {
  internshipId: string;
  className?: string;
};

const STORAGE_KEY = "saved_internships_v1";

function readSaved() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.map((value) => String(value)));
  } catch {
    return new Set<string>();
  }
}

function writeSaved(values: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...values]));
}

export function SaveInternshipButton({ internshipId, className = "" }: SaveInternshipButtonProps) {
  const [saved, setSaved] = useState<boolean>(() => readSaved().has(internshipId));

  return (
    <button
      type="button"
      onClick={() => {
        const set = readSaved();
        if (set.has(internshipId)) {
          set.delete(internshipId);
          setSaved(false);
        } else {
          set.add(internshipId);
          setSaved(true);
        }
        writeSaved(set);
      }}
      className={`inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold transition ${
        saved
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
      } ${className}`}
      aria-pressed={saved}
    >
      {saved ? "Saved" : "Save"}
    </button>
  );
}

