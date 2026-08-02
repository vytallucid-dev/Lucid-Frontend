"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, X, Loader2, Link2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "@/components/toast";
import {
  uploadTradeScreenshot,
  removeTradeScreenshot,
  MAX_SCREENSHOTS,
} from "@/lib/storage/screenshots";
import { isHttpUrl, linkHostLabel, resolvePastedUrl } from "@/lib/storage/screenshot-source";

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--lucid-ink-3)",
  marginBottom: 6,
  display: "block",
};

/** Is the user typing somewhere? A paste in Notes belongs to Notes. */
function isTextEntry(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(type);
  }
  return false;
}

/**
 * Renders one stored screenshot. The field holds arbitrary strings, so a stored
 * value may be an uploaded image, a direct image URL, or a page link that could
 * not be resolved to an image. An <img> that fails to decode swaps itself for a
 * link — a broken image is never shown.
 */
export function ScreenshotImage({
  url,
  height,
  fit = "cover",
}: {
  url: string;
  height: number | string;
  fit?: "cover" | "contain";
}) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center justify-center gap-1.5 w-full text-center"
        style={{
          height,
          background: "var(--lucid-surface-2)",
          color: "var(--lucid-ink-2)",
          padding: 8,
        }}
      >
        <Link2 size={14} aria-hidden="true" />
        <span className="lx-micro" style={{ wordBreak: "break-all" }}>
          {linkHostLabel(url)}
        </span>
      </a>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Trade screenshot"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      style={{ width: "100%", height, objectFit: fit, display: "block" }}
    />
  );
}

interface ScreenshotUploaderProps {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  /** When true, listens for clipboard paste anywhere (use inside a modal). */
  pasteTarget?: boolean;
}

/**
 * Upload control for trade screenshots: click to pick a file, drag-and-drop, or
 * paste. Pasted images are compressed client-side and pushed through the exact
 * same Supabase Storage upload a file selection uses; pasted URLs are stored
 * verbatim (the field is an unvalidated string array on both client and
 * server). `value` holds whatever strings resulted.
 */
export function ScreenshotUploader({
  value,
  onChange,
  label = "Screenshots",
  pasteTarget = true,
}: ScreenshotUploaderProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  // In-flight count as a ref too: two pastes fired a frame apart must not both
  // pass the room check against the same stale length.
  const pendingRef = useRef(0);
  const bump = useCallback((delta: number) => {
    pendingRef.current = Math.max(0, pendingRef.current + delta);
    setPending(pendingRef.current);
  }, []);

  // Mirror the latest value/onChange so async loops don't read stale data.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  /** Append without waiting for the parent's re-render — several attachments
   *  can land inside one batch, and each must add to the last, not replace it. */
  const append = useCallback((url: string) => {
    const next = [...valueRef.current, url];
    valueRef.current = next;
    onChangeRef.current(next);
  }, []);

  const roomLeft = useCallback(
    () => MAX_SCREENSHOTS - valueRef.current.length - pendingRef.current,
    [],
  );

  const addFiles = useCallback(async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    if (!user?.id) {
      toast.error("You need to be signed in to upload screenshots.");
      return;
    }
    const room = roomLeft();
    if (room <= 0) {
      toast.warning(`You can attach up to ${MAX_SCREENSHOTS} screenshots.`);
      return;
    }
    const toUpload = images.slice(0, room);
    if (images.length > room) toast.warning(`Only ${room} more screenshot${room === 1 ? "" : "s"} can be added.`);

    bump(toUpload.length);
    for (const file of toUpload) {
      try {
        const url = await uploadTradeScreenshot(file, user.id);
        append(url);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't upload screenshot.");
      } finally {
        bump(-1);
      }
    }
  }, [user, append, roomLeft, bump]);

  /** A pasted link. Nothing is uploaded — the URL itself is the stored value. */
  const addUrl = useCallback(async (raw: string) => {
    if (roomLeft() <= 0) {
      toast.warning(`You can attach up to ${MAX_SCREENSHOTS} screenshots.`);
      return;
    }
    bump(1);
    try {
      const resolved = await resolvePastedUrl(raw);
      if (!resolved) return;
      if (valueRef.current.includes(resolved.url)) return;
      append(resolved.url);
      if (resolved.kind === "link") {
        toast.info("That link isn't an image, so it's attached as a link.", {
          title: "Attached as a link",
        });
      }
    } catch {
      toast.error("Couldn't attach that link.");
    } finally {
      bump(-1);
    }
  }, [append, roomLeft, bump]);

  // Clipboard. Images always win, wherever focus is — that is the whole point
  // of pasting a chart while typing a note. A URL is only intercepted when the
  // trader is NOT typing, so pasting a link into Notes still pastes into Notes.
  // Anything else is left completely alone: no toast, no error, no side effect.
  useEffect(() => {
    if (!pasteTarget) return;
    const onPaste = (e: ClipboardEvent) => {
      const data = e.clipboardData;
      if (!data) return;

      const files: File[] = [];
      for (const it of data.items) {
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        void addFiles(files);
        return;
      }

      if (isTextEntry(e.target as Element) || isTextEntry(document.activeElement)) return;

      const text = data.getData("text/uri-list") || data.getData("text/plain");
      if (!text || !isHttpUrl(text)) return;
      e.preventDefault();
      void addUrl(text);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pasteTarget, addFiles, addUrl]);

  function handleRemove(url: string) {
    const next = value.filter((u) => u !== url);
    valueRef.current = next;
    onChange(next);
    void removeTradeScreenshot(url); // best-effort cleanup; no-ops for external URLs
  }

  const full = value.length + pending >= MAX_SCREENSHOTS;

  return (
    <div>
      <label style={LABEL_STYLE}>
        {label}{" "}
        <span style={{ textTransform: "none", fontWeight: 400, color: "var(--lucid-ink-3)" }}>
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
            border: `1.5px dashed ${dragOver ? "var(--lucid-accent-bd)" : "var(--lucid-line-2)"}`,
            background: dragOver ? "var(--lucid-accent-bg)" : "var(--lucid-surface-2)",
            padding: "12px",
          }}
        >
          <ImagePlus size={20} style={{ color: dragOver ? "var(--lucid-accent)" : "var(--lucid-ink-3)" }} />
          <p style={{ fontSize: 12.5, color: "var(--lucid-ink-2)", textAlign: "center" }}>
            Drop or click to select an image
          </p>
          {/* Quiet, not loud: the paste affordance is the one worth knowing and
              it costs one micro line. */}
          <p className="lx-micro" style={{ textAlign: "center" }}>
            Or paste anywhere in this dialog — image or link
          </p>
        </div>
      )}

      {/* Thumbnails + in-flight tiles */}
      {(value.length > 0 || pending > 0) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {value.map((url) => (
            <div
              key={url}
              className="relative rounded-lg overflow-hidden group"
              style={{
                width: 84,
                height: 60,
                border: "1px solid var(--lucid-line)",
                background: "var(--lucid-surface-2)",
              }}
            >
              <ScreenshotImage url={url} height={60} />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                aria-label="Remove screenshot"
                className="absolute top-1 right-1 flex items-center justify-center rounded-md transition-opacity"
                style={{
                  width: 20,
                  height: 20,
                  background: "var(--lucid-scrim)",
                  color: "var(--lucid-ink)",
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {Array.from({ length: pending }).map((_, i) => (
            <div
              key={`up-${i}`}
              className="flex items-center justify-center rounded-lg"
              style={{
                width: 84,
                height: 60,
                border: "1px solid var(--lucid-accent-bd)",
                background: "var(--lucid-accent-bg)",
              }}
            >
              <Loader2 size={16} className="animate-spin" style={{ color: "var(--lucid-accent)" }} />
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
      <p style={{ fontSize: 13, color: "var(--lucid-ink-3)", fontStyle: "italic" }}>
        No screenshots attached.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {urls.map((url) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="lx-gallery-tile block">
          <ScreenshotImage url={url} height={tileHeight} />
        </a>
      ))}
    </div>
  );
}
