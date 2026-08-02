"use client";

// ─── Pasted screenshot sources ───────────────────────────────────────────────
// The trade record's `screenshots` field is `string[]` on the client and
// `z.array(z.string()).max(20)` on the server — no URL validation, no bucket
// prefix, no shape constraint. So a pasted external link can be stored
// verbatim, exactly like an uploaded asset's public URL. Nothing here invents a
// storage mechanism; it only decides WHICH string to store.
//
// TradingView: its share action produces https://www.tradingview.com/x/{id}/,
// which is an HTML page, not an image. The image itself lives at
// https://s3.tradingview.com/snapshots/{first-char-lowercased}/{id}.png — a
// convention, not documented API. Rather than trusting that, we derive the
// candidate and then actually LOAD it: if the browser decodes an image, that is
// proof, and the direct image URL is what gets stored. If it does not, the link
// is stored exactly as pasted and rendered as a link. A broken <img> is never
// an outcome.

const TRADINGVIEW_SHARE =
  /^https?:\/\/(?:www\.)?tradingview\.com\/x\/([A-Za-z0-9]+)\/?(?:[?#].*)?$/i;

/** The snapshot image URL a tradingview.com/x/{id}/ link most likely points at,
 *  or null if this isn't that shape. Always verified before use. */
export function tradingViewSnapshotUrl(url: string): string | null {
  const m = TRADINGVIEW_SHARE.exec(url.trim());
  if (!m) return null;
  const id = m[1];
  return `https://s3.tradingview.com/snapshots/${id[0].toLowerCase()}/${id}.png`;
}

export function isHttpUrl(text: string): boolean {
  const t = text.trim();
  if (!/^https?:\/\/\S+$/i.test(t)) return false;
  try {
    new URL(t);
    return true;
  } catch {
    return false;
  }
}

/** Does this URL decode as an image in this browser? Uses an <img> load, which
 *  is not subject to CORS for display, so it works against any host. */
export function probeImage(url: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    const img = new Image();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    img.onload = () => {
      window.clearTimeout(timer);
      finish(img.naturalWidth > 0);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      finish(false);
    };
    img.referrerPolicy = "no-referrer";
    img.src = url;
  });
}

export interface ResolvedSource {
  /** The string to store on the trade record. */
  url: string;
  /** Whether it was verified to render as an image. */
  kind: "image" | "link";
}

/** Decide what to store for a pasted URL. Returns null when the text isn't a
 *  URL at all — the caller does nothing in that case, by design. */
export async function resolvePastedUrl(raw: string): Promise<ResolvedSource | null> {
  const url = raw.trim();
  if (!isHttpUrl(url)) return null;

  const snapshot = tradingViewSnapshotUrl(url);
  if (snapshot) {
    if (await probeImage(snapshot)) return { url: snapshot, kind: "image" };
    // Could not resolve it reliably — keep the trader's link, show it as a link.
    return { url, kind: "link" };
  }

  if (await probeImage(url)) return { url, kind: "image" };
  return { url, kind: "link" };
}

/** A short, readable stand-in for a link we render as a link. */
export function linkHostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
