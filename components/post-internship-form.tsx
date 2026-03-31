"use client";

import { FormEvent, useState, startTransition } from "react";

const initialState = {
  title: "",
  skillsRequired: "",
  level: "beginner",
  type: "paid",
  isPaid: true,
  location: "",
  country: "Pakistan",
  isRemote: false,
  duration: "",
  resumeRequired: true,
  description: "",
};

export function PostInternshipForm() {
  const MAX_ORIGINAL_IMAGE_SIZE = 3 * 1024 * 1024;
  const TARGET_MIN_BYTES = 100 * 1024;
  const TARGET_MAX_BYTES = 150 * 1024;

  const [form, setForm] = useState(initialState);
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
      const bestDistance = Math.abs(
        bestBlob.size - (TARGET_MIN_BYTES + TARGET_MAX_BYTES) / 2
      );
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
      throw new Error(
        "Could not compress image to 100-150KB. Please choose a different image."
      );
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
        const imageUrl = await uploadImage();
        const payload = {
          ...form,
          imageUrl,
          skillsRequired: form.skillsRequired
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        };

        const res = await fetch("/api/internships", {
          method: "POST",
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
            setMessage(data.error ?? "Could not publish internship");
          }
          return;
        }

        window.location.href = `/internships/${data.internship.slug}`;
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Something went wrong");
      } finally {
        setSaving(false);
      }
    });
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
    >
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-slate-900">Post internship</h2>
        <p className="mt-1 text-sm text-slate-600">Create a clean, professional listing for applicants.</p>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium text-slate-800">Title</span>
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium text-slate-800">Skills required</span>
          <input
            value={form.skillsRequired}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, skillsRequired: event.target.value }))
            }
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-800">Level</span>
          <select
            value={form.level}
            onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-800">Type</span>
          <select
            value={form.type}
            onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
          >
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="learn_and_earn">Learn and Earn</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-800">City</span>
          <input
            value={form.location}
            onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-800">Country</span>
          <input
            value={form.country}
            onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-800">Duration</span>
          <input
            value={form.duration}
            onChange={(event) => setForm((prev) => ({ ...prev, duration: event.target.value }))}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            required
          />
        </label>

        <div className="sm:col-span-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isRemote}
                onChange={(event) => setForm((prev) => ({ ...prev, isRemote: event.target.checked }))}
                className="h-4 w-4"
              />
              Remote friendly
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isPaid}
                onChange={(event) => setForm((prev) => ({ ...prev, isPaid: event.target.checked }))}
                className="h-4 w-4"
              />
              Paid internship
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.resumeRequired}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, resumeRequired: event.target.checked }))
                }
                className="h-4 w-4"
              />
              Resume required
            </label>
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium text-slate-800">Description</span>
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            maxLength={300}
            className="min-h-32 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium text-slate-800">Cover image</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700"
          />
          <p className="text-xs text-slate-500">
            Optional. Max 3MB input. Image will be auto-compressed before upload.
          </p>
        </label>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
        {message ? <p className="text-sm text-red-600">{message}</p> : <span />}
        <button
          type="submit"
          title={saving ? "Publishing" : "Publish"}
          aria-label={saving ? "Publishing" : "Publish"}
          disabled={saving}
          className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Publishing..." : "Publish"}
        </button>
      </div>
    </form>
  );
}