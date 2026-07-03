"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  radius: number;
  baseOpacity: number;
  twinklePeriod: number;
  twinkleOffset: number;
  driftX: number;
  driftY: number;
  warm: boolean;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  startedAt: number;
  duration: number;
}

const DESKTOP_STAR_COUNT = 50;
const MOBILE_STAR_COUNT = 28;
const MOBILE_BREAKPOINT = 640;
const MAX_DPR = 2;
const SHOOTING_STAR_MIN_GAP_MS = 14_000;
const SHOOTING_STAR_MAX_GAP_MS = 26_000;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createStar(width: number, height: number): Star {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    radius: randomBetween(0.4, 1.1),
    baseOpacity: randomBetween(0.1, 0.35),
    twinklePeriod: randomBetween(4000, 8000),
    twinkleOffset: Math.random() * Math.PI * 2,
    // <=3px/min drift, split across x/y.
    driftX: randomBetween(-1.5, 1.5) / 60_000,
    driftY: randomBetween(-1.5, 1.5) / 60_000,
    warm: Math.random() < 0.35,
  };
}

function starColor(star: Star, opacity: number): string {
  // Warm white (--lucid-ink) to faint gold (--lucid-accent), per spec.
  return star.warm ? `rgba(205, 167, 79, ${opacity})` : `rgba(241, 239, 233, ${opacity})`;
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    let stars: Star[] = [];
    let shootingStar: ShootingStar | null = null;
    let nextShootingStarAt = performance.now() + randomBetween(SHOOTING_STAR_MIN_GAP_MS, SHOOTING_STAR_MAX_GAP_MS);
    let rafId: number | null = null;
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

    function starCount() {
      return width < MOBILE_BREAKPOINT ? MOBILE_STAR_COUNT : DESKTOP_STAR_COUNT;
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      if (!canvas) return;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: starCount() }, () => createStar(width, height));
    }

    function maybeStartShootingStar(now: number) {
      if (shootingStar || now < nextShootingStarAt) return;
      const fromLeft = Math.random() < 0.5;
      const startX = fromLeft ? -20 : width + 20;
      const startY = randomBetween(0, height * 0.5);
      const duration = randomBetween(700, 1000);
      const angle = fromLeft ? randomBetween(0.15, 0.4) : Math.PI - randomBetween(0.15, 0.4);
      const distance = randomBetween(width * 0.35, width * 0.55);
      const speed = distance / duration;
      shootingStar = {
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: randomBetween(60, 110),
        startedAt: now,
        duration,
      };
    }

    function drawShootingStar(now: number) {
      if (!shootingStar || !ctx) return;
      const elapsed = now - shootingStar.startedAt;
      if (elapsed > shootingStar.duration) {
        shootingStar = null;
        nextShootingStarAt = now + randomBetween(SHOOTING_STAR_MIN_GAP_MS, SHOOTING_STAR_MAX_GAP_MS);
        return;
      }
      const t = elapsed / shootingStar.duration;
      const progressFade = t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1;
      const headX = shootingStar.x + shootingStar.vx * elapsed;
      const headY = shootingStar.y + shootingStar.vy * elapsed;
      const dirLen = Math.hypot(shootingStar.vx, shootingStar.vy) || 1;
      const tailX = headX - (shootingStar.vx / dirLen) * shootingStar.length;
      const tailY = headY - (shootingStar.vy / dirLen) * shootingStar.length;

      const gradient = ctx.createLinearGradient(tailX, tailY, headX, headY);
      gradient.addColorStop(0, "rgba(241, 239, 233, 0)");
      gradient.addColorStop(1, `rgba(241, 239, 233, ${0.55 * progressFade})`);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.stroke();
    }

    function drawStaticField() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) {
        ctx.beginPath();
        ctx.fillStyle = starColor(star, star.baseOpacity);
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function frame(now: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      for (const star of stars) {
        star.x = (star.x + star.driftX * 16 + width) % width;
        star.y = (star.y + star.driftY * 16 + height) % height;
        const twinkle =
          0.5 + 0.5 * Math.sin((now / star.twinklePeriod) * Math.PI * 2 + star.twinkleOffset);
        const opacity = star.baseOpacity * (0.55 + 0.45 * twinkle);
        ctx.beginPath();
        ctx.fillStyle = starColor(star, opacity);
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      maybeStartShootingStar(now);
      drawShootingStar(now);

      rafId = requestAnimationFrame(frame);
    }

    function start() {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(frame);
    }

    function stop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function handleVisibility() {
      if (document.hidden) {
        stop();
      } else if (!reduceMotion) {
        start();
      }
    }

    function handleResize() {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        resize();
        if (reduceMotion) drawStaticField();
      }, 150);
    }

    resize();

    if (reduceMotion) {
      drawStaticField();
    } else {
      start();
      document.addEventListener("visibilitychange", handleVisibility);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      stop();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -1 }}
    />
  );
}
