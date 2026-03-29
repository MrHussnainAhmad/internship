import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/lib/auth";
import { requireEnv } from "@/lib/env";

cloudinary.config({
  cloud_name: requireEnv("CLOUDINARY_CLOUD_NAME"),
  api_key: requireEnv("CLOUDINARY_API_KEY"),
  api_secret: requireEnv("CLOUDINARY_API_SECRET"),
  secure: true,
});

const MAX_IMAGE_SIZE = 3 * 1024 * 1024;
const MAX_PDF_SIZE = 300 * 1024;

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
        transformation: isPdf
          ? undefined
          : [{ width: 800, height: 800, crop: "limit", quality: "auto:best" }],
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
  const session = await auth();
  if (!session?.user?.email) {
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
      { error: "PDF must be <= 300KB" },
      { status: 400 }
    );
  }
  if (!isPdf && file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: "Image must be <= 1MB" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
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
