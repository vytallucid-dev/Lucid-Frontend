import { Sparkles } from "lucide-react";

/**
 * Shared shell for every page under /auth. Single-pane centered card on a
 * dark background, ambient blue glow behind the card. Mobile-friendly at
 * 375px (responsive padding + max-width cap).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{
        background: "#020817",
      }}
    >
      {/* Ambient background — radial blue glow + subtle grid noise */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59, 130, 246, 0.18), transparent 60%), radial-gradient(ellipse 60% 40% at 50% 110%, rgba(168, 85, 247, 0.08), transparent 60%)",
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
                "linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(99, 102, 241, 0.18))",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              boxShadow: "0 0 24px rgba(59, 130, 246, 0.18)",
            }}
          >
            <Sparkles size={18} style={{ color: "#93C5FD" }} />
          </div>
          <span
            className="text-2xl font-bold tracking-tight"
            style={{ color: "#F1F5F9", letterSpacing: "-0.03em" }}
          >
            LUCID
          </span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7 sm:p-8"
          style={{
            background:
              "linear-gradient(180deg, rgba(15, 23, 42, 0.85), rgba(10, 18, 30, 0.92))",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(148, 163, 184, 0.12)",
            boxShadow:
              "0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 32px 80px rgba(0, 0, 0, 0.5), 0 0 64px rgba(59, 130, 246, 0.06)",
          }}
        >
          {children}
        </div>

        {/* Footer tagline */}
        <p
          className="text-[11px] text-center mt-6"
          style={{ color: "#475569" }}
        >
          Your personal trading operating system.
        </p>
      </div>
    </div>
  );
}
