"use client";

import { FormEvent, startTransition, useState } from "react";

type EditInternshipFormProps = {
  slug: string;
  initial: {
    title: string;
    skillsRequired: string[];
    level: string;
    type: string;
    isPaid: boolean;
    location: string;
    country: string;
    isRemote: boolean;
    duration: string;
    resumeRequired: boolean;
    description: string;
    imageUrl?: string;
  };
};

export function EditInternshipForm({ slug, initial }: EditInternshipFormProps) {
  const MAX_ORIGINAL_IMAGE_SIZE = 3 * 1024 * 1024;
  const TARGET_MIN_BYTES = 100 * 1024;
  const TARGET_MAX_BYTES = 150 * 1024;

  const [form, setForm] = useState({
    title: initial.title,
    skillsRequired: initial.skillsRequired.join(", "),
    level: initial.level,
    type: initial.type,
    isPaid: initial.isPaid,
    location: initial.location,
    country: initial.country,
    isRemote: initial.isRemote,
    duration: initial.duration,
    resumeRequired: initial.resumeRequired,
    description: initial.description,
    imageUrl: initial.imageUrl ?? "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function compressImageToTarget(file: File): Promise<File> {
    if (!file.type.startsWith("image/")) {
      throw new Error("Only image files are allowed.");
    }
    if (file.size > MAX_ORIGINAL_IMAGE_SIZE) {
      throw new Error("Image must be <= 3MB before compression.");
    }

    const bitmap = await createImageBitmap(file);
    const maxDimension = 1400;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      throw new Error("Could not prepare image compression.");
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const toBlob = (quality: number) =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Image compression failed."));
              return;
            }
            resolve(blob);
          },
          "image/webp",
          quality
        );
      });

    let low = 0.2;
    let high = 0.95;
    let bestBlob: Blob | null = null;

    for (let i = 0; i < 12; i += 1) {
      const quality = (low + high) / 2;
      const blob = await toBlob(quality);
      if (!bestBlob) bestBlob = blob;

      if (blob.size >= TARGET_MIN_BYTES && blob.size <= TARGET_MAX_BYTES) {
        bestBlob = blob;
        break;
      }

      const currentDistance = Math.abs(blob.size - (TARGET_MIN_BYTES + TARGET_MAX_BYTES) / 2);
      const bestDistance = Math.abs(bestBlob.size - (TARGET_MIN_BYTES + TARGET_MAX_BYTES) / 2);
      if (currentDistance < bestDistance) {
        bestBlob = blob;
      }

      if (blob.size > TARGET_MAX_BYTES) {
        high = quality - 0.02;
      } else {
        low = quality + 0.02;
      }
    }

    if (!bestBlob) {
      throw new Error("Could not compress image.");
    }
    if (bestBlob.size < TARGET_MIN_BYTES || bestBlob.size > TARGET_MAX_BYTES) {
      throw new Error("Could not compress image to 100-150KB. Please choose a different image.");
    }

    return new File([bestBlob], "compressed.webp", { type: "image/webp" });
  }

  async function uploadImage() {
    if (!imageFile) return "";
    const compressedFile = await compressImageToTarget(imageFile);
    const formData = new FormData();
    formData.append("file", compressedFile);
    formData.append("kind", "image");

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Image upload failed");
    }
    return String(data.url ?? "");
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    startTransition(async () => {
      try {
        let nextImageUrl = form.imageUrl;
        if (imageFile) {
          nextImageUrl = await uploadImage();
        }

        const payload = {
          ...form,
          imageUrl: nextImageUrl,
          skillsRequired: form.skillsRequired
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        };

        const res = await fetch(`/api/internships/${slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          const fieldErrors = data?.issues?.fieldErrors as
            | Record<string, string[]>
            | undefined;
          const firstIssue = fieldErrors
            ? Object.entries(fieldErrors).find(([, messages]) => messages?.length)
            : undefined;
          if (firstIssue) {
            const [field, messages] = firstIssue;
            setMessage(`${field}: ${messages[0]}`);
          } else {
            setMessage(data.error ?? "Could not update internship");
          }
          return;
        }

        window.location.href = `/internships/${slug}`;
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Something went wrong");
      } finally {
        setSaving(false);
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Title
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Skills Required (comma separated)
          <input
            value={form.skillsRequired}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, skillsRequired: event.target.value }))
            }
            className="rounded-md border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Level
          <select
            value={form.level}
            onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            value={form.type}
            onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="learn_and_earn">Learn and Earn</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          City
          <input
            value={form.location}
            onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Country
          <input
            value={form.country}
            onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Duration
          <input
            value={form.duration}
            onChange={(event) => setForm((prev) => ({ ...prev, duration: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isRemote}
            onChange={(event) => setForm((prev) => ({ ...prev, isRemote: event.target.checked }))}
          />
          Remote friendly
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isPaid}
            onChange={(event) => setForm((prev) => ({ ...prev, isPaid: event.target.checked }))}
          />
          Paid internship
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.resumeRequired}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, resumeRequired: event.target.checked }))
            }
          />
          Resume required
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Description (max 300 chars)
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            maxLength={300}
            className="min-h-28 rounded-md border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Cover Image (optional, max 3MB input, auto-compressed to 100-150KB)
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          {form.imageUrl ? (
            <a
              href={form.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-blue-700 hover:text-blue-900"
            >
              View current image
            </a>
          ) : null}
        </label>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        {message ? <p className="text-sm text-red-600">{message}</p> : <span />}
        <button
          type="submit"
          title={saving ? "Updating" : "Update internship"}
          aria-label={saving ? "Updating" : "Update internship"}
          disabled={saving}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Updating..." : "Update internship"}
        </button>
      </div>
    </form>
  );
}
