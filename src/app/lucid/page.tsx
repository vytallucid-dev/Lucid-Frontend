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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-6 py-16">
      {/* Glow orb backdrop */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)",
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
            background: "rgba(59,130,246,0.1)",
            border: "1px solid rgba(59,130,246,0.2)",
            boxShadow: "0 0 40px rgba(59,130,246,0.12)",
          }}
        >
          <Sparkles size={32} style={{ color: "#3B82F6" }} />
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#F1F5F9",
            letterSpacing: "-0.02em",
            marginBottom: 12,
            lineHeight: 1.2,
          }}
        >
          Lucid AI is coming.
        </h1>

        <p
          style={{
            fontSize: 15,
            color: "#64748B",
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
        <div
          className="w-full rounded-2xl p-1 mb-12"
          style={{
            background: "rgba(20,28,40,0.7)",
            border: "1px solid rgba(59,130,246,0.18)",
            boxShadow:
              "0 0 32px rgba(59,130,246,0.06), 0 8px 40px rgba(0,0,0,0.4)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Fake message history */}
          <div className="px-5 pt-5 pb-4 flex flex-col gap-4">
            {/* User bubble */}
            <div className="flex justify-end">
              <div
                className="rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-xs text-left"
                style={{
                  background: "rgba(59,130,246,0.18)",
                  border: "1px solid rgba(59,130,246,0.2)",
                }}
              >
                <p style={{ fontSize: 13, color: "#E2E8F0", lineHeight: 1.5 }}>
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
                  background: "rgba(59,130,246,0.12)",
                  border: "1px solid rgba(59,130,246,0.2)",
                }}
              >
                <Sparkles size={13} style={{ color: "#3B82F6" }} />
              </div>
              <div
                className="rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-sm text-left"
                style={{
                  background: "rgba(28,38,54,0.8)",
                  border: "1px solid rgba(148,163,184,0.1)",
                }}
              >
                <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>
                  Your Short model requires EMA rejection to be complete before
                  entry. Trade 21 is already running on this setup — you're
                  already in. No double-entry signal here.
                </p>
              </div>
            </div>
          </div>

          {/* Fake input bar */}
          <div
            className="flex items-center gap-3 px-4 mx-1 mb-1 rounded-xl"
            style={{
              height: 50,
              background: "rgba(10,14,20,0.6)",
              border: "1px solid rgba(148,163,184,0.08)",
            }}
          >
            <Sparkles size={15} style={{ color: "#334155" }} />
            <span
              style={{
                fontSize: 13,
                color: "#334155",
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
                background: "rgba(59,130,246,0.15)",
                border: "1px solid rgba(59,130,246,0.2)",
              }}
            >
              <span style={{ color: "#475569", fontSize: 14 }}>↵</span>
            </div>
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-4 w-full mb-12">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl p-5 text-left"
              style={{
                background: "rgba(20,28,40,0.5)",
                border: "1px solid rgba(148,163,184,0.08)",
              }}
            >
              <div
                className="flex items-center justify-center rounded-lg mb-3"
                style={{
                  width: 32,
                  height: 32,
                  background: "rgba(59,130,246,0.1)",
                  border: "1px solid rgba(59,130,246,0.15)",
                  color: "#3B82F6",
                }}
              >
                {f.icon}
              </div>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#E2E8F0",
                  marginBottom: 6,
                }}
              >
                {f.title}
              </p>
              <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p style={{ fontSize: 12, color: "#334155" }}>
          Lucid AI activates after your journal reaches critical mass.{" "}
          <span style={{ color: "#475569" }}>
            Keep logging trades in Phase 1.
          </span>
        </p>
      </div>
    </div>
  );
}
