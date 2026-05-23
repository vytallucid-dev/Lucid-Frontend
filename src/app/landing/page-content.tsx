"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart2,
  TrendingUp,
  BookOpen,
  Compass,
  Globe,
  Layers,
  ChevronRight,
  Activity,
  Zap,
  Shield,
  Database,
} from "lucide-react";

// ─── Animated grid background ─────────────────────────────────────────────────
function GridBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Base grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
        }}
      />
      {/* Top-left glow */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "-10%",
          width: "60%",
          height: "80%",
          background:
            "radial-gradient(ellipse, rgba(59,130,246,0.12) 0%, transparent 65%)",
          filter: "blur(40px)",
        }}
      />
      {/* Top-right glow */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          right: "-10%",
          width: "50%",
          height: "70%",
          background:
            "radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}
      />
      {/* Center accent */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "80%",
          height: "40%",
          background:
            "radial-gradient(ellipse, rgba(59,130,246,0.05) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
    </div>
  );
}

// ─── Ticker strip ─────────────────────────────────────────────────────────────
const TICKERS = [
  { sym: "EUR/USD", val: "+0.34%", up: true },
  { sym: "GBP/USD", val: "-0.12%", up: false },
  { sym: "USD/JPY", val: "+0.21%", up: true },
  { sym: "XAU/USD", val: "+0.87%", up: true },
  { sym: "NIFTY 50", val: "+1.14%", up: true },
  { sym: "US 2Y", val: "4.82%", up: false },
  { sym: "US NFP", val: "+177K", up: true },
  { sym: "EUR CPI", val: "2.3%", up: false },
  { sym: "COT USD", val: "Bullish", up: true },
  { sym: "Compass", val: "Risk-On", up: true },
];

function TickerStrip() {
  const items = [...TICKERS, ...TICKERS]; // doubled for seamless loop
  return (
    <div
      className="overflow-hidden py-3 border-y"
      style={{
        borderColor: "rgba(59,130,246,0.12)",
        background: "rgba(10,22,40,0.6)",
      }}
    >
      <style>{`
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ticker-inner { display: flex; gap: 48px; width: max-content; animation: ticker 28s linear infinite; }
        .ticker-inner:hover { animation-play-state: paused; }
      `}</style>
      <div className="ticker-inner">
        {items.map((t, i) => (
          <span key={i} className="flex items-center gap-2 whitespace-nowrap text-xs">
            <span style={{ color: "#64748B" }}>{t.sym}</span>
            <span
              style={{ color: t.up ? "#10B981" : "#EF4444" }}
              className="font-mono font-medium"
            >
              {t.val}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Feature cards data ────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Globe,
    color: "#3B82F6",
    title: "EdgeFinder",
    subtitle: "Multi-currency macro intelligence",
    description:
      "Scores USD, EUR, GBP, JPY, and Gold across 50+ economic indicators from GDP to COT positioning. Generates unified bull/bear signals with a quantitative edge.",
  },
  {
    icon: Activity,
    color: "#10B981",
    title: "NIFTY Pulse",
    subtitle: "Indian market scorecard",
    description:
      "Tracks 13 composite indicators — FII flows, VIX, DXY, Brent oil, IIP, CPI, PMI — and synthesises a real-time directional score for India's benchmark index.",
  },
  {
    icon: Compass,
    color: "#6366F1",
    title: "Compass",
    subtitle: "Macro regime classification",
    description:
      "A six-factor regime engine that classifies the market environment as Risk-On, Risk-Off, Transitional, or Neutral — driving context-aware trade decisions.",
  },
  {
    icon: Layers,
    color: "#8B5CF6",
    title: "Oracle",
    subtitle: "Pattern recognition engine",
    description:
      "Identifies classical chart patterns and candlestick formations in real-time, ranked by historical edge and relevance to the current regime.",
  },
  {
    icon: BookOpen,
    color: "#F59E0B",
    title: "Ledger",
    subtitle: "Trade journal & analytics",
    description:
      "Log every trade with entry, target, stop, rationale, and post-mortem. Analytics surface your edge per setup, per session, and per market condition.",
  },
  {
    icon: Database,
    color: "#EC4899",
    title: "Data Pipeline",
    subtitle: "Automated data ingestion",
    description:
      "Pulls from FRED, ForexFactory, CFTC COT reports, and NSE on automated schedules — zero manual data entry for market-driven indicators.",
  },
];

// ─── How it works steps ────────────────────────────────────────────────────────
const STEPS = [
  {
    num: "01",
    icon: Database,
    color: "#3B82F6",
    title: "Data Ingestion",
    body: "Automated pipelines pull economic releases, COT positioning, price data, and sentiment — all normalised to a common timeline.",
  },
  {
    num: "02",
    icon: BarChart2,
    color: "#8B5CF6",
    title: "Quantitative Scoring",
    body: "A rule-based engine scores every indicator from –2 (strongly bearish) to +2 (strongly bullish), then aggregates into asset-level composite scores.",
  },
  {
    num: "03",
    icon: TrendingUp,
    color: "#10B981",
    title: "Trade with Conviction",
    body: "Regime, score, and pattern signal converge into a clear directional view — with the full evidence trail at a glance before you click.",
  },
];

// ─── Stat cards ────────────────────────────────────────────────────────────────
const STATS = [
  { label: "Economic Indicators", value: "50+" },
  { label: "Asset Classes", value: "5" },
  { label: "Data Sources", value: "6+" },
  { label: "Weekly COT Updates", value: "Auto" },
];

// ─── Counter hook ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            setCount(Math.floor(p * target));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);

  return { count, ref };
}

export function LandingPageContent() {
  return (
    <div
      className="min-h-screen flex flex-col w-full"
      style={{ background: "#020817", color: "#F1F5F9" }}
    >

      {/* ── Navbar ── */}
      <nav
        className="sticky top-0 z-50 w-full"
        style={{
          background: "rgba(2,8,23,0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)",
              boxShadow: "0 0 16px rgba(59,130,246,0.4)",
            }}
          >
            <Zap size={14} color="#fff" />
          </div>
          <span className="text-base font-bold tracking-wide" style={{ color: "#F1F5F9" }}>
            LUCID
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ color: "#94A3B8" }}
            onMouseEnter={(e) =>
              ((e.target as HTMLAnchorElement).style.color = "#F1F5F9")
            }
            onMouseLeave={(e) =>
              ((e.target as HTMLAnchorElement).style.color = "#94A3B8")
            }
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)",
              color: "#fff",
              boxShadow: "0 0 20px rgba(59,130,246,0.3)",
            }}
          >
            Get Started
          </Link>
        </div>
        </div>{/* end inner nav container */}
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-20 overflow-hidden">
        <GridBackground />

        {/* badge */}
        <div
          className="relative mb-6 flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium"
          style={{
            background: "rgba(59,130,246,0.1)",
            border: "1px solid rgba(59,130,246,0.25)",
            color: "#60A5FA",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full pulse-live"
            style={{ background: "#3B82F6" }}
          />
          Your Personal Trading Operating System
        </div>

        {/* headline */}
        <h1
          className="relative max-w-4xl text-5xl md:text-7xl font-extrabold leading-[1.08] tracking-tight mb-6"
          style={{
            background:
              "linear-gradient(135deg, #F1F5F9 0%, #94A3B8 40%, #3B82F6 70%, #6366F1 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Trade with
          <br />
          Institutional Clarity
        </h1>

        <p
          className="relative max-w-xl text-lg leading-relaxed mb-10"
          style={{ color: "#64748B" }}
        >
          LUCID quantifies macro data, regime context, and positioning signals
          into a unified score — so every trade decision is evidence-based,
          not emotional.
        </p>

        <div className="relative flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/auth/signup"
            className="flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition-all hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)",
              color: "#fff",
              boxShadow: "0 0 32px rgba(59,130,246,0.35)",
            }}
          >
            Start for Free
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/auth/login"
            className="flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition-all hover:scale-[1.02]"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#94A3B8",
            }}
          >
            Sign in
            <ChevronRight size={16} />
          </Link>
        </div>

        {/* hero preview card */}
        <div
          className="relative mt-16 sm:mt-20 w-full max-w-4xl rounded-2xl overflow-hidden"
          style={{
            background: "rgba(10,22,40,0.7)",
            border: "1px solid rgba(59,130,246,0.15)",
            boxShadow:
              "0 0 0 1px rgba(59,130,246,0.08), 0 32px 80px rgba(0,0,0,0.6), 0 0 60px rgba(59,130,246,0.08)",
          }}
        >
          {/* fake topbar */}
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="w-3 h-3 rounded-full" style={{ background: "rgba(239,68,68,0.5)" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "rgba(245,158,11,0.5)" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "rgba(16,185,129,0.5)" }} />
            <div className="mx-auto text-[10px] font-mono" style={{ color: "#334155" }}>
              lucid — EdgeFinder Dashboard
            </div>
          </div>
          {/* mock dashboard grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5">
            {[
              { label: "USD", score: "+1.8", color: "#10B981", trend: "Bullish" },
              { label: "EUR", score: "-0.9", color: "#EF4444", trend: "Bearish" },
              { label: "GBP", score: "+0.5", color: "#F59E0B", trend: "Neutral" },
              { label: "JPY", score: "-1.4", color: "#EF4444", trend: "Bearish" },
              { label: "XAU", score: "+1.2", color: "#10B981", trend: "Bullish" },
              { label: "NIFTY", score: "+1.6", color: "#10B981", trend: "Bullish" },
              { label: "Compass", score: "Risk-On", color: "#6366F1", trend: "" },
              { label: "COT", score: "+2.0", color: "#10B981", trend: "Strong" },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-xl p-3 flex flex-col gap-1.5"
                style={{
                  background: `${c.color}08`,
                  border: `1px solid ${c.color}20`,
                }}
              >
                <p className="text-[9px] font-medium uppercase tracking-wider" style={{ color: "#475569" }}>
                  {c.label}
                </p>
                <p className="text-base font-bold" style={{ color: c.color }}>
                  {c.score}
                </p>
                {c.trend && (
                  <p className="text-[9px]" style={{ color: c.color, opacity: 0.7 }}>
                    {c.trend}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ticker ── */}
      <TickerStrip />

      {/* ── Stats ── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-6 text-center"
              style={{
                background: "rgba(10,22,40,0.6)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p
                className="text-3xl font-extrabold mb-1"
                style={{
                  background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {s.value}
              </p>
              <p className="text-xs" style={{ color: "#64748B" }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "#3B82F6" }}
            >
              Everything in one OS
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold"
              style={{ color: "#F1F5F9" }}
            >
              Built for the macro-aware trader
            </h2>
            <p className="mt-4 text-base max-w-xl mx-auto" style={{ color: "#64748B" }}>
              Every module is connected. Regime drives scoring, scoring drives
              pattern relevance, and every trade lives in your journal — all
              in a single tab.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300"
                style={{
                  background: "rgba(10,22,40,0.6)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = `${f.color}30`;
                  el.style.boxShadow = `0 0 32px ${f.color}10`;
                  el.style.background = "rgba(10,22,40,0.9)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = "rgba(255,255,255,0.06)";
                  el.style.boxShadow = "none";
                  el.style.background = "rgba(10,22,40,0.6)";
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${f.color}15`, border: `1px solid ${f.color}30` }}
                >
                  <f.icon size={18} color={f.color} />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: "#F1F5F9" }}>
                    {f.title}
                  </p>
                  <p className="text-[11px] font-medium mb-2" style={{ color: f.color }}>
                    {f.subtitle}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>
                    {f.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        className="py-20 px-4 sm:px-6 lg:px-8"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(10,22,40,0.5) 50%, transparent 100%)",
        }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "#6366F1" }}
            >
              The workflow
            </p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: "#F1F5F9" }}>
              From raw data to trade conviction
            </h2>
          </div>

          <div className="relative flex flex-col md:flex-row gap-6">
            {/* connector line */}
            <div
              className="hidden md:block absolute top-12 left-1/6 right-1/6 h-px"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent)",
              }}
            />
            {STEPS.map((s, i) => (
              <div
                key={s.num}
                className="relative flex-1 rounded-2xl p-6 flex flex-col gap-4"
                style={{
                  background: "rgba(10,22,40,0.7)",
                  border: `1px solid ${s.color}20`,
                  boxShadow: `0 0 40px ${s.color}06`,
                }}
              >
                <div className="flex items-start justify-between">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${s.color}15`, border: `1px solid ${s.color}30` }}
                  >
                    <s.icon size={18} color={s.color} />
                  </div>
                  <span
                    className="text-4xl font-black"
                    style={{ color: `${s.color}18`, lineHeight: 1 }}
                  >
                    {s.num}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-2" style={{ color: "#F1F5F9" }}>
                    {s.title}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Data sources strip ── */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs uppercase tracking-widest mb-6" style={{ color: "#334155" }}>
            Powered by
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {[
              { name: "FRED", color: "#3B82F6", desc: "US Federal Reserve" },
              { name: "ForexFactory", color: "#10B981", desc: "Economic Calendar" },
              { name: "CFTC COT", color: "#8B5CF6", desc: "Commitments of Traders" },
              { name: "NSE", color: "#F59E0B", desc: "National Stock Exchange" },
              { name: "Supabase", color: "#3ECF8E", desc: "Real-time Backend" },
            ].map((src) => (
              <div
                key={src.name}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5"
                style={{
                  background: "rgba(10,22,40,0.6)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: src.color }}
                />
                <div>
                  <p className="text-xs font-semibold" style={{ color: "#94A3B8" }}>
                    {src.name}
                  </p>
                  <p className="text-[9px]" style={{ color: "#475569" }}>
                    {src.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(59,130,246,0.1) 0%, transparent 70%)",
          }}
        />
        <div className="relative max-w-2xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-6 text-xs font-medium"
            style={{
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.2)",
              color: "#10B981",
            }}
          >
            <Shield size={11} />
            Free to get started
          </div>
          <h2
            className="text-3xl md:text-5xl font-extrabold mb-5 leading-tight"
            style={{ color: "#F1F5F9" }}
          >
            Stop guessing.
            <br />
            Start scoring.
          </h2>
          <p className="text-base mb-10" style={{ color: "#64748B" }}>
            Join LUCID and bring institutional-grade clarity to every trade you make.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-sm font-bold transition-all hover:scale-[1.03]"
            style={{
              background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)",
              color: "#fff",
              boxShadow: "0 0 40px rgba(59,130,246,0.4)",
            }}
          >
            Create Your Account
            <ArrowRight size={16} />
          </Link>
          <p className="mt-4 text-xs" style={{ color: "#334155" }}>
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="underline"
              style={{ color: "#64748B" }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="px-4 sm:px-6 lg:px-8 py-8 mt-auto"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)",
              }}
            >
              <Zap size={11} color="#fff" />
            </div>
            <span className="text-sm font-bold tracking-wide" style={{ color: "#475569" }}>
              LUCID
            </span>
          </div>
          <p className="text-xs" style={{ color: "#334155" }}>
            Personal Trading Operating System — built for serious traders.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="text-xs transition-colors" style={{ color: "#334155" }}>
              Sign in
            </Link>
            <Link href="/auth/signup" className="text-xs transition-colors" style={{ color: "#334155" }}>
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
