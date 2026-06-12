"use client";

// Trade-screenshot storage: client-side compression + Supabase Storage upload.
//
// Images are downscaled and re-encoded (WebP where supported) BEFORE upload so a
// single screenshot lands at ~100–250 KB rather than several MB — important on
// the Supabase free tier's limited storage. The returned value is a public URL
// stored on the trade/planned record's `screenshots[]` array.

import { createClient } from "@/lib/supabase/client";

/** Public Storage bucket screenshots live in. Create it once in Supabase. */
export const SCREENSHOT_BUCKET = "trade-screenshots";

const MAX_DIMENSION = 1600; // longest edge, px
const QUALITY = 0.72;
export const MAX_SCREENSHOTS = 8;
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024; // reject >15MB originals

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image file."));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

/**
 * Downscale to MAX_DIMENSION on the longest edge and re-encode. Tries WebP first
 * (best ratio); falls back to JPEG when the browser can't encode WebP.
 */
export async function compressImage(file: File): Promise<{ blob: Blob; ext: string }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { width, height } = img;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported in this browser.");
    ctx.drawImage(img, 0, 0, w, h);

    let blob = await canvasToBlob(canvas, "image/webp", QUALITY);
    let ext = "webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await canvasToBlob(canvas, "image/jpeg", QUALITY);
      ext = "jpg";
    }
    if (!blob) throw new Error("Image compression failed.");

    // If compression somehow produced something larger than the source, keep the
    // original bytes (still re-typed) but prefer the smaller of the two.
    return { blob, ext };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function uniqueName(ext: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${rand}.${ext}`;
}

/**
 * Compress `file`, upload to Supabase Storage under `{userId}/...`, and return
 * its public URL. Throws with a friendly message on failure (caller toasts it).
 */
export async function uploadTradeScreenshot(file: File, userId: string): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`"${file.name}" isn't an image.`);
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(`"${file.name}" is too large (max 15 MB).`);
  }

  const { blob, ext } = await compressImage(file);
  const path = `${userId}/${uniqueName(ext)}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });

  if (error) {
    const msg = /bucket.*not found/i.test(error.message)
      ? `Storage bucket "${SCREENSHOT_BUCKET}" not found. Create a public bucket with that name in Supabase → Storage.`
      : error.message;
    throw new Error(msg);
  }

  const { data } = supabase.storage.from(SCREENSHOT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Best-effort delete of a previously-uploaded screenshot by its public URL. */
export async function removeTradeScreenshot(publicUrl: string): Promise<void> {
  const marker = `/${SCREENSHOT_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  const supabase = createClient();
  await supabase.storage.from(SCREENSHOT_BUCKET).remove([path]);
}
