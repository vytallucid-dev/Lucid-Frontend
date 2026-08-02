"use client";

// ─── Session globe ───────────────────────────────────────────────────────────
// Canvas, hand-built, no library. Ported from the design mock with two changes:
// every colour is resolved from a --lucid-* token at runtime (canvas cannot
// read var(), so the tokens are read off the document and parsed once), and
// motion is gated.
//
// Reduced motion: the globe does NOT disappear and does NOT freeze at an
// arbitrary angle. It renders a single static frame rotated so the currently
// daylit meridian faces the viewer, and redraws only when the clock ticks past
// a minute. The information — which markets are open, where they are, where the
// hour hand sits — is identical; only the spin is gone.

import { useEffect, useRef } from "react";
import {
  LAND_POINTS,
  SESSIONS,
  isSessionOpen,
  rotationForHour,
  toVector,
  type Vec3,
} from "./sessions";

interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Parse a token's computed value. Handles #rgb, #rrggbb and rgb()/rgba(). */
function parseColor(value: string): RGB {
  const v = value.trim();
  if (v.startsWith("#")) {
    const hex = v.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }
  const nums = v.match(/-?\d+(\.\d+)?/g);
  if (nums && nums.length >= 3) {
    return { r: Number(nums[0]), g: Number(nums[1]), b: Number(nums[2]) };
  }
  return { r: 255, g: 255, b: 255 };
}

function readToken(name: string): RGB {
  if (typeof window === "undefined") return { r: 255, g: 255, b: 255 };
  return parseColor(getComputedStyle(document.documentElement).getPropertyValue(name));
}

const rgba = (c: RGB, a: number) => `rgba(${c.r},${c.g},${c.b},${a})`;

/** Globe tilt, radians. Puts the north pole slightly away from the viewer. */
const TILT = 0.38;

export function SessionGlobe({
  utcHours,
  reducedMotion,
}: {
  utcHours: number;
  reducedMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The clock, mirrored into a ref so the animation loop reads the latest hour
  // without being torn down and rebuilt every tick. Written in an effect, never
  // during render.
  const hourRef = useRef(utcHours);
  useEffect(() => {
    hourRef.current = utcHours;
  }, [utcHours]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Tokens resolved once per mount — the theme is static at runtime.
    const C = {
      accent: readToken("--lucid-accent"),
      ink: readToken("--lucid-ink"),
      ink2: readToken("--lucid-ink-2"),
      ink3: readToken("--lucid-ink-3"),
      surface3: readToken("--lucid-surface-3"),
      page: readToken("--lucid-page-bg-deep"),
      line: readToken("--lucid-line-2"),
    };
    const sessionColors = SESSIONS.map((s) => readToken(s.token));
    const sessionVectors: Vec3[] = SESSIONS.map((s) => toVector(s.lat, s.lon));

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const fit = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (w === width && h === height) return;
      width = w;
      height = h;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    const sinT = Math.sin(TILT);
    const cosT = Math.cos(TILT);

    /** Rotate a unit vector, tilt it, and project to screen. `z` > 0 = facing us. */
    const project = (v: Vec3, rot: number, cx: number, cy: number, R: number) => {
      const x = v[0] * Math.cos(rot) + v[2] * Math.sin(rot);
      const z0 = -v[0] * Math.sin(rot) + v[2] * Math.cos(rot);
      return {
        x: cx + x * R,
        y: cy - (v[1] * cosT - z0 * sinT) * R,
        z: v[1] * sinT + z0 * cosT,
      };
    };

    const render = (rot: number, phase: number) => {
      fit();
      if (!width || !height) return;

      const cx = width / 2;
      const cy = height / 2;
      const R = Math.min(width, height) * 0.3;
      const hour = hourRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Ambient bloom behind the sphere.
      const bloom = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2);
      bloom.addColorStop(0, rgba(C.accent, 0.06));
      bloom.addColorStop(1, rgba(C.accent, 0));
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 2, 0, Math.PI * 2);
      ctx.fill();

      // The sphere itself — lit from the upper left, falling to the page ground.
      const body = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.4, R * 0.05, cx, cy, R);
      body.addColorStop(0, rgba(C.surface3, 0.9));
      body.addColorStop(1, rgba(C.page, 0.95));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(C.accent, 0.18);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // Landmass. Points on the far side are culled; near ones brighten.
      for (const point of LAND_POINTS) {
        const p = project(point, rot, cx, cy, R);
        if (p.z <= 0.03) continue;
        ctx.fillStyle = rgba(C.ink2, 0.07 + p.z * 0.5);
        const s = 0.7 + p.z * 0.9;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }

      // City markers. Open sessions are lit and emit an expanding ring.
      SESSIONS.forEach((session, i) => {
        const p = project(sessionVectors[i], rot, cx, cy, R);
        if (p.z <= 0.04) return; // facing away — skip this marker
        const open = isSessionOpen(session, hour);
        const fade = Math.min(1, p.z * 2.2);

        if (open && phase >= 0) {
          const pulse = (phase * 0.5 + session.lat) % 1;
          ctx.strokeStyle = rgba(C.ink, (1 - pulse) * 0.28 * fade);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3 + pulse * 14, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.globalAlpha = fade;
        ctx.fillStyle = open ? rgba(sessionColors[i], 1) : rgba(C.ink3, 0.4);
        ctx.beginPath();
        ctx.arc(p.x, p.y, open ? 2.6 : 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // The 24-hour dial: one ring per session, drawn over its trading window.
      const dialR = R * 1.42;
      const angle = (h: number) => (h / 24) * Math.PI * 2 - Math.PI / 2;
      SESSIONS.forEach((session, i) => {
        const open = isSessionOpen(session, hour);
        const rr = dialR + 5 + i * 5;
        ctx.strokeStyle = open ? rgba(sessionColors[i], 0.85) : rgba(C.line, 0.5);
        ctx.lineWidth = open ? 2 : 1;
        ctx.beginPath();
        if (session.start < session.end) {
          ctx.arc(cx, cy, rr, angle(session.start), angle(session.end));
        } else {
          // Wraps midnight — two arcs.
          ctx.arc(cx, cy, rr, angle(session.start), angle(24));
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx, cy, rr, angle(0), angle(session.end));
        }
        ctx.stroke();
      });

      // The hand, marking the current UTC hour across every ring.
      const hand = angle(hour);
      ctx.strokeStyle = rgba(C.ink, 0.7);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(hand) * (dialR - 14), cy + Math.sin(hand) * (dialR - 14));
      ctx.lineTo(cx + Math.cos(hand) * (dialR + 34), cy + Math.sin(hand) * (dialR + 34));
      ctx.stroke();
    };

    if (reducedMotion) {
      // One frame, at the rotation the current hour earns. `phase = -1`
      // suppresses the pulse rings, which are motion by definition.
      render(rotationForHour(hourRef.current), -1);
      const onResize = () => render(rotationForHour(hourRef.current), -1);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    const loop = (t: number) => {
      const seconds = t / 1000;
      render(seconds * 0.06, seconds);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // utcHours is intentionally absent: the loop reads it from hourRef, and the
    // static branch re-runs via the reducedMotion redraw below.
  }, [reducedMotion]);

  // Static mode still has to follow the clock — redraw when the hour changes.
  useEffect(() => {
    if (!reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Nudge the resize path, which re-renders at the current hour.
    window.dispatchEvent(new Event("resize"));
  }, [utcHours, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      role="img"
      aria-label="World globe showing which trading sessions are currently open"
    />
  );
}
