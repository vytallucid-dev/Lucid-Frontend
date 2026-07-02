import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-56px)] px-4">
      <div className="lt-card p-6 sm:p-10 max-w-130 w-full text-center">
        <div className="flex justify-center mb-5">
          <SettingsIcon size={48} style={{ color: "var(--lucid-accent)" }} />
        </div>
        <h2
          className="lt-serif text-2xl font-bold mb-3"
          style={{ color: "var(--lucid-ink)", letterSpacing: "-0.02em" }}
        >
          Settings
        </h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--lucid-ink-3)" }}>
          Configure your Lucid experience. Asset watchlists, notification
          preferences, data sources, and display options.
        </p>
        <div className="flex justify-center">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: "var(--lucid-accent-bg)",
              color: "var(--lucid-accent)",
              border: "1px solid var(--lucid-accent-bd)",
            }}
          >
            ⚡ In Development
          </span>
        </div>
      </div>
    </div>
  );
}
