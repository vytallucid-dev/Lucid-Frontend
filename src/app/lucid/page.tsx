"use client";

import {
  Sparkles,
  MessageSquare,
  Brain,
  TrendingUp,
  Shield,
} from "lucide-react";

const features = [
  {
    icon: <Brain size={16} />,
    title: "Pre-Trade Discussion",
    desc: "Debate every setup with Lucid before you enter. Get a second opinion grounded in your own trading system.",
  },
  {
    icon: <MessageSquare size={16} />,
    title: "Debrief & Reflect",
    desc: "After every trade, Lucid reviews your execution against your model rules and surfaces patterns you missed.",
  },
  {
    icon: <TrendingUp size={16} />,
    title: "Edge Analysis",
    desc: "Ask questions about your journal data. Which sessions are killing you? Is conviction sizing actually working?",
  },
  {
    icon: <Shield size={16} />,
    title: "Full Trading Context",
    desc: "Lucid knows your models, your history, your accounts, and your planned trades — not just a chat prompt.",
  },
];

export default function LucidPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-4 sm:px-6 py-10 sm:py-16">
      {/* Glow orb backdrop */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(600px, 90vw)",
          height: "min(600px, 90vw)",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, var(--lucid-accent-bg) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-2xl w-full text-center">
        {/* Phase badge */}
        <span
          className="pill mb-8"
          style={{
            background: "rgba(168,85,247,0.15)",
            color: "#A855F7",
            border: "1px solid rgba(168,85,247,0.3)",
            fontSize: 11,
            padding: "4px 12px",
          }}
        >
          Phase 3
        </span>

        {/* Icon */}
        <div
          className="flex items-center justify-center rounded-2xl mb-7"
          style={{
            width: 72,
            height: 72,
            background: "var(--lucid-accent-bg)",
            border: "1px solid var(--lucid-accent-bd)",
          }}
        >
          <Sparkles size={32} style={{ color: "var(--lucid-accent)" }} />
        </div>

        {/* Heading */}
        <h1
          className="lt-serif"
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "var(--lucid-ink)",
            letterSpacing: "-0.02em",
            marginBottom: 12,
            lineHeight: 1.2,
          }}
        >
          Lucid AI is coming.
        </h1>

        <p
          className="px-1"
          style={{
            fontSize: 15,
            color: "var(--lucid-ink-2)",
            lineHeight: 1.7,
            marginBottom: 48,
            maxWidth: 480,
          }}
        >
          Your personal AI trading partner — built on the full context of your
          journal, models, accounts, and planned trades. Not a generic chatbot.
          Your edge, amplified.
        </p>

        {/* Mock chat input — non-functional, visual only */}
        <div className="lt-card w-full rounded-2xl p-1 mb-12">
          {/* Fake message history */}
          <div className="px-3 sm:px-5 pt-5 pb-4 flex flex-col gap-4">
            {/* User bubble */}
            <div className="flex justify-end">
              <div
                className="rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] sm:max-w-xs text-left"
                style={{
                  background: "var(--lucid-accent-bg)",
                  border: "1px solid var(--lucid-accent-bd)",
                }}
              >
                <p style={{ fontSize: 13, color: "var(--lucid-ink)", lineHeight: 1.5 }}>
                  Should I enter EURUSD short right now?
                </p>
              </div>
            </div>

            {/* Lucid bubble */}
            <div className="flex justify-start gap-3">
              <div
                className="flex items-center justify-center rounded-full shrink-0"
                style={{
                  width: 28,
                  height: 28,
                  background: "var(--lucid-accent-bg)",
                  border: "1px solid var(--lucid-accent-bd)",
                }}
              >
                <Sparkles size={13} style={{ color: "var(--lucid-accent)" }} />
              </div>
              <div className="lt-card-2 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] sm:max-w-sm text-left">
                <p style={{ fontSize: 13, color: "var(--lucid-ink-2)", lineHeight: 1.6 }}>
                  Your Short model requires EMA rejection to be complete before
                  entry. Trade 21 is already running on this setup — you're
                  already in. No double-entry signal here.
                </p>
              </div>
            </div>
          </div>

          {/* Fake input bar */}
          <div
            className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 mx-1 mb-1 rounded-xl"
            style={{
              height: 50,
              background: "var(--lucid-surface-2)",
              border: "1px solid var(--lucid-line)",
            }}
          >
            <Sparkles size={15} style={{ color: "var(--lucid-ink-3)" }} />
            <span
              style={{
                fontSize: 13,
                color: "var(--lucid-ink-3)",
                flex: 1,
                textAlign: "left",
              }}
            >
              Ask Lucid anything about your trading...
            </span>
            <div
              className="rounded-lg flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                background: "var(--lucid-accent-bg)",
                border: "1px solid var(--lucid-accent-bd)",
              }}
            >
              <span style={{ color: "var(--lucid-ink-2)", fontSize: 14 }}>↵</span>
            </div>
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full mb-12">
          {features.map((f) => (
            <div key={f.title} className="lt-card rounded-xl p-5 text-left">
              <div
                className="flex items-center justify-center rounded-lg mb-3"
                style={{
                  width: 32,
                  height: 32,
                  background: "var(--lucid-accent-bg)",
                  border: "1px solid var(--lucid-accent-bd)",
                  color: "var(--lucid-accent)",
                }}
              >
                {f.icon}
              </div>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--lucid-ink)",
                  marginBottom: 6,
                }}
              >
                {f.title}
              </p>
              <p style={{ fontSize: 12, color: "var(--lucid-ink-2)", lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>
          Lucid AI activates after your journal reaches critical mass.{" "}
          <span style={{ color: "var(--lucid-ink-2)" }}>
            Keep logging trades in Phase 1.
          </span>
        </p>
      </div>
    </div>
  );
}
