import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
      <div className="glass-card p-10 max-w-[520px] w-full text-center">
        <div className="flex justify-center mb-5">
          <SettingsIcon size={48} style={{ color: "#3B82F6" }} />
        </div>
        <h2
          className="text-2xl font-bold mb-3"
          style={{ color: "#F1F5F9", letterSpacing: "-0.02em" }}
        >
          Settings
        </h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: "#64748B" }}>
          Configure your Lucid experience. Asset watchlists, notification
          preferences, data sources, and display options.
        </p>
        <div className="flex justify-center">
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
      </div>
    </div>
  );
}
