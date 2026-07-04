import { Sparkles } from "lucide-react";

/**
 * Shared shell for every page under /auth. Single-pane centered card on a
 * dark background, ambient gold glow behind the card. Mobile-friendly at
 * 375px (responsive padding + max-width cap).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{
        background: "#090a0d",
      }}
    >
      {/* Ambient background — radial gold glow + subtle grid noise */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(205, 167, 79, 0.18), transparent 60%), radial-gradient(ellipse 60% 40% at 50% 110%, rgba(205, 167, 79, 0.06), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148, 163, 184, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, black 30%, transparent 80%)",
        }}
      />

      <div className="w-full max-w-105 relative auth-card-enter">
        {/* Wordmark */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(205, 167, 79, 0.18), rgba(184, 147, 63, 0.18))",
              border: "1px solid rgba(205, 167, 79, 0.35)",
              boxShadow: "0 0 24px rgba(205, 167, 79, 0.18)",
            }}
          >
            <Sparkles size={18} style={{ color: "#e0c987" }} />
          </div>
          <span
            className="text-2xl font-bold tracking-tight"
            style={{ color: "#f1efe9", letterSpacing: "-0.03em" }}
          >
            LUCID
          </span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7 sm:p-8"
          style={{
            background:
              "linear-gradient(180deg, rgba(23, 26, 32, 0.85), rgba(14, 15, 19, 0.92))",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow:
              "0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 32px 80px rgba(0, 0, 0, 0.5), 0 0 64px rgba(205, 167, 79, 0.06)",
          }}
        >
          {children}
        </div>

        {/* Footer tagline */}
        <p
          className="text-[11px] text-center mt-6"
          style={{ color: "#62646c" }}
        >
          Your personal trading operating system.
        </p>
      </div>
    </div>
  );
}
