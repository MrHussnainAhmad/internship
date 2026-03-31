import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { getApiUser } from "@/lib/api-auth";
import { requireEnv } from "@/lib/env";

cloudinary.config({
  cloud_name: requireEnv("CLOUDINARY_CLOUD_NAME"),
  api_key: requireEnv("CLOUDINARY_API_KEY"),
  api_secret: requireEnv("CLOUDINARY_API_SECRET"),
  secure: true,
});

const MAX_IMAGE_SIZE = 3 * 1024 * 1024;
const MAX_PDF_SIZE = 130 * 1024;
const TARGET_IMAGE_MIN_SIZE = 100 * 1024;
const TARGET_IMAGE_MAX_SIZE = 150 * 1024;
const HARD_IMAGE_MAX_SIZE = 220 * 1024;
const IMAGE_DIMENSION_CANDIDATES = [1400, 1200, 1000, 900, 800];
const IMAGE_QUALITY_MIN = 25;
const IMAGE_QUALITY_MAX = 95;

async function encodeWebp(
  buffer: Buffer,
  maxDimension: number,
  quality: number
) {
  return sharp(buffer)
    .rotate()
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 })
    .toBuffer();
}

async function compressImageToTarget(buffer: Buffer) {
  const midpoint = Math.round((TARGET_IMAGE_MIN_SIZE + TARGET_IMAGE_MAX_SIZE) / 2);
  let globalBest: Buffer | null = null;

  for (const dimension of IMAGE_DIMENSION_CANDIDATES) {
    let low = IMAGE_QUALITY_MIN;
    let high = IMAGE_QUALITY_MAX;
    let bestForDimension: Buffer | null = null;

    for (let i = 0; i < 10; i += 1) {
      const quality = Math.round((low + high) / 2);
      const candidate = await encodeWebp(buffer, dimension, quality);

      if (
        candidate.length >= TARGET_IMAGE_MIN_SIZE &&
        candidate.length <= TARGET_IMAGE_MAX_SIZE
      ) {
        return candidate;
      }

      if (
        !bestForDimension ||
        Math.abs(candidate.length - midpoint) <
          Math.abs(bestForDimension.length - midpoint)
      ) {
        bestForDimension = candidate;
      }

      if (candidate.length > TARGET_IMAGE_MAX_SIZE) {
        high = quality - 1;
      } else {
        low = quality + 1;
      }
    }

    if (
      bestForDimension &&
      (!globalBest ||
        Math.abs(bestForDimension.length - midpoint) <
          Math.abs(globalBest.length - midpoint))
    ) {
      globalBest = bestForDimension;
    }

    if (bestForDimension && bestForDimension.length <= HARD_IMAGE_MAX_SIZE) {
      return bestForDimension;
    }
  }

  if (globalBest && globalBest.length <= HARD_IMAGE_MAX_SIZE) {
    return globalBest;
  }

  throw new Error(
    "Could not compress image below 220KB. Please choose a simpler image."
  );
}

function uploadBuffer({
  buffer,
  folder,
  resourceType,
  publicId,
  isPdf,
}: {
  buffer: Buffer;
  folder: string;
  resourceType: "image" | "raw";
  publicId: string;
  isPdf?: boolean;
}) {
  return new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        format: isPdf ? "pdf" : "webp",
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve({ secure_url: result.secure_url });
      }
    );

    stream.end(buffer);
  });
}

export async function POST(request: Request) {
  const currentUser = await getApiUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = String(formData.get("kind") ?? "image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const isPdf = kind === "pdf";
  if (isPdf && file.size > MAX_PDF_SIZE) {
    return NextResponse.json(
      { error: "PDF must be <= 130KB" },
      { status: 400 }
    );
  }
  if (!isPdf && file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: "Image must be <= 3MB" },
      { status: 400 }
    );
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const buffer = isPdf ? rawBuffer : await compressImageToTarget(rawBuffer);
  const publicId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const uploaded = await uploadBuffer({
    buffer,
    folder: isPdf ? "internhub/resumes" : "internhub/images",
    resourceType: isPdf ? "raw" : "image",
    publicId,
    isPdf,
  });

  return NextResponse.json({ ok: true, url: uploaded.secure_url });
}
