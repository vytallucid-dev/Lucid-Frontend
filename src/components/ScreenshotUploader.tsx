"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "@/components/toast";
import {
  uploadTradeScreenshot,
  removeTradeScreenshot,
  MAX_SCREENSHOTS,
} from "@/lib/storage/screenshots";

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#64748B",
  marginBottom: 6,
  display: "block",
};

interface ScreenshotUploaderProps {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  /** When true, listens for clipboard paste anywhere (use inside a modal). */
  pasteTarget?: boolean;
}

/**
 * Upload control for trade screenshots: click to pick a file, drag-and-drop, or
 * paste from the clipboard. Images are compressed client-side then uploaded to
 * Supabase Storage; `value` holds the resulting public URLs.
 */
export function ScreenshotUploader({
  value,
  onChange,
  label = "Screenshots",
  pasteTarget = true,
}: ScreenshotUploaderProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  // Mirror the latest value/onChange so async upload loops don't read stale data.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const addFiles = useCallback(async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    if (!user?.id) {
      toast.error("You need to be signed in to upload screenshots.");
      return;
    }
    const room = MAX_SCREENSHOTS - valueRef.current.length;
    if (room <= 0) {
      toast.warning(`You can attach up to ${MAX_SCREENSHOTS} screenshots.`);
      return;
    }
    const toUpload = images.slice(0, room);
    if (images.length > room) toast.warning(`Only ${room} more screenshot${room === 1 ? "" : "s"} can be added.`);

    setUploading((n) => n + toUpload.length);
    for (const file of toUpload) {
      try {
        const url = await uploadTradeScreenshot(file, user.id);
        onChangeRef.current([...valueRef.current, url]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't upload screenshot.");
      } finally {
        setUploading((n) => Math.max(0, n - 1));
      }
    }
  }, [user]);

  // Clipboard paste support (image data → upload).
  useEffect(() => {
    if (!pasteTarget) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const it of items) {
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        void addFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pasteTarget, addFiles]);

  function handleRemove(url: string) {
    onChange(value.filter((u) => u !== url));
    void removeTradeScreenshot(url); // best-effort cleanup
  }

  const full = value.length + uploading >= MAX_SCREENSHOTS;

  return (
    <div>
      <label style={LABEL_STYLE}>
        {label}{" "}
        <span style={{ textTransform: "none", fontWeight: 400, color: "#475569" }}>
          ({value.length}/{MAX_SCREENSHOTS})
        </span>
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ""; // allow re-selecting the same file
          void addFiles(files);
        }}
      />

      {/* Drop zone */}
      {!full && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void addFiles(Array.from(e.dataTransfer.files ?? []));
          }}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg cursor-pointer transition-colors"
          style={{
            minHeight: 84,
            border: `1.5px dashed ${dragOver ? "rgba(59,130,246,0.6)" : "rgba(148,163,184,0.2)"}`,
            background: dragOver ? "rgba(59,130,246,0.06)" : "rgba(148,163,184,0.02)",
            color: "#475569",
            padding: "12px",
          }}
        >
          <ImagePlus size={20} style={{ color: dragOver ? "#60A5FA" : "#475569" }} />
          <p style={{ fontSize: 12.5, color: "#94A3B8", textAlign: "center" }}>
            Drop, click to select, or paste an image
          </p>
          <p style={{ fontSize: 10.5, color: "#475569" }}>Compressed automatically before upload</p>
        </div>
      )}

      {/* Thumbnails + in-flight tiles */}
      {(value.length > 0 || uploading > 0) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {value.map((url) => (
            <div
              key={url}
              className="relative rounded-lg overflow-hidden group"
              style={{ width: 84, height: 60, border: "1px solid rgba(148,163,184,0.15)", background: "rgba(148,163,184,0.06)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Trade screenshot" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                aria-label="Remove screenshot"
                className="absolute top-1 right-1 flex items-center justify-center rounded-md transition-opacity"
                style={{ width: 20, height: 20, background: "rgba(0,0,0,0.65)", color: "#fff" }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <div
              key={`up-${i}`}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 84, height: 60, border: "1px solid rgba(59,130,246,0.2)", background: "rgba(59,130,246,0.06)" }}
            >
              <Loader2 size={16} className="animate-spin" style={{ color: "#60A5FA" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Read-only gallery of stored screenshots (drawers / detail pages). */
export function ScreenshotGallery({ urls, tileHeight = 200 }: { urls: string[]; tileHeight?: number }) {
  if (urls.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "#334155", fontStyle: "italic" }}>No screenshots attached.</p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {urls.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--border-subtle)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Trade screenshot" style={{ width: "100%", height: tileHeight, objectFit: "cover", display: "block" }} />
        </a>
      ))}
    </div>
  );
}
