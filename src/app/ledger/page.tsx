import { BookOpen } from "lucide-react";

export default function LedgerPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-56px)] px-4">
      <div className="glass-card p-6 sm:p-10 max-w-130 w-full text-center">
        <div className="flex justify-center mb-5">
          <BookOpen size={48} style={{ color: "#3B82F6" }} />
        </div>
        <h2
          className="text-2xl font-bold mb-3"
          style={{ color: "#F1F5F9", letterSpacing: "-0.02em" }}
        >
          Ledger
        </h2>
        <p
          className="text-sm leading-relaxed mb-6"
          style={{ color: "#64748B" }}
        >
          Log trades, track performance, plan setups, and build a complete
          record of your trading decisions — with AI-powered pre-trade analysis
          and post-trade debriefs.
        </p>

        {/* Status badge */}
        <div className="flex justify-center mb-8">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: "rgba(59, 130, 246, 0.12)",
              color: "#60A5FA",
              border: "1px solid rgba(59, 130, 246, 0.25)",
              boxShadow: "0 0 16px rgba(59, 130, 246, 0.1)",
            }}
          >
            ⚡ In Development
          </span>
        </div>

        {/* Feature pills */}
        <div className="grid grid-cols-2 gap-3">
          {[
            "📝 Trade Journal",
            "🗓️ Trade Planner",
            "📊 Performance Analytics",
            "🧠 AI Trade Memory",
          ].map((feature) => (
            <div
              key={feature}
              className="px-4 py-3 rounded-lg text-xs font-medium"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                color: "#64748B",
              }}
            >
              {feature}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
