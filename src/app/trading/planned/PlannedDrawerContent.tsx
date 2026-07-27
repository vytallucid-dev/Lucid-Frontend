"use client";

import { type PlannedTrade, pairs, getDistanceToEntry } from "@/lib/demo-data";
import { ScreenshotGallery } from "@/components/ScreenshotUploader";

// ── Helpers shared with table ─────────────────────────────────────────────────
export function calcRR(t: PlannedTrade): number {
  const entry = t.planned_entry;
  const sl = t.planned_sl;
  const tp = t.planned_main_tp;
  const reward = Math.abs(tp - entry);
  const risk = Math.abs(entry - sl);
  if (risk === 0) return 0;
  return reward / risk;
}

export function ModelPill({ model }: { model: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    "4HPullBack": { bg: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "var(--lucid-accent-bd)" },
    Breakout:    { bg: "var(--lucid-ctx-bg)",  color: "var(--lucid-ctx)", border: "var(--lucid-ctx-bd)" },
    Short:       { bg: "var(--lucid-surface-3)",  color: "var(--lucid-ink-2)", border: "var(--lucid-line-2)" },
  };
  const s = styles[model] ?? styles["Short"];
  return (
    <span className="pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {model}
    </span>
  );
}

export function ConvictionPill({ conviction }: { conviction: string }) {
  if (conviction === "High")
    return (
      <span className="pill" style={{ background: "var(--lucid-line-2)", color: "var(--lucid-ink)", border: "1px solid var(--lucid-line-3)" }}>
        High
      </span>
    );
  if (conviction === "Medium")
    return (
      <span className="pill" style={{ background: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line-2)" }}>
        Medium
      </span>
    );
  return (
    <span className="pill" style={{ background: "var(--lucid-surface-3)", color: "var(--lucid-ink-3)", border: "1px solid var(--lucid-line)" }}>
      Low
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    Ready:       { bg: "var(--lucid-warn-bg)", color: "var(--lucid-warn)", border: "var(--lucid-warn-bd)" },
    Watching:    { bg: "var(--lucid-ctx-bg)", color: "var(--lucid-ctx)", border: "var(--lucid-ctx-bd)" },
    Invalidated: { bg: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "var(--lucid-line)" },
    Cancelled:   { bg: "var(--lucid-surface-3)",   color: "var(--lucid-ink-3)", border: "var(--lucid-line)" },
  };
  const s = map[status] ?? map["Cancelled"];
  return (
    <span className="pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  );
}

// ── Distance badge ────────────────────────────────────────────────────────────
export function DistanceBadge({ trade, large }: { trade: PlannedTrade; large?: boolean }) {
  const dist = getDistanceToEntry(trade);

  if (dist.direction === "at") {
    return (
      <span className="flex items-center gap-1.5 lt-num" style={{ color: "var(--lucid-pos)", fontWeight: 700, fontSize: large ? 22 : 13 }}>
        <span
          className="pulse-live"
          style={{
            display: "inline-block",
            width: large ? 10 : 7,
            height: large ? 10 : 7,
            borderRadius: "50%",
            background: "var(--lucid-pos)",
            flexShrink: 0,
          }}
        />
        at entry
      </span>
    );
  }

  const within10 = dist.pips <= 10;
  const within50 = dist.pips <= 50;

  let color = "var(--lucid-ink-3)";
  if (within10) color = "var(--lucid-warn)";
  else if (within50) color = "var(--lucid-ink)";

  const arrow = dist.direction === "above" ? "↑" : "↓";

  return (
    <span className="lt-num" style={{ color, fontWeight: within10 ? 600 : 400, fontSize: large ? 22 : 13 }}>
      {arrow} {dist.pips} pips {dist.direction}
    </span>
  );
}

// ── Setup ladder (planned version) ────────────────────────────────────────────
function PlannedLadder({ trade }: { trade: PlannedTrade }) {
  const isSell = trade.direction === "Sell";

  interface LevelItem {
    label: string;
    price: number;
    type: "sl" | "entry" | "tp1" | "tp_main";
  }

  const levels: LevelItem[] = [];
  if (isSell) {
    levels.push({ label: "SL", price: trade.planned_sl, type: "sl" });
    levels.push({ label: "Entry", price: trade.planned_entry, type: "entry" });
    if (trade.planned_first_tp) levels.push({ label: "First TP", price: trade.planned_first_tp, type: "tp1" });
    levels.push({ label: "Main TP", price: trade.planned_main_tp, type: "tp_main" });
  } else {
    levels.push({ label: "Main TP", price: trade.planned_main_tp, type: "tp_main" });
    if (trade.planned_first_tp) levels.push({ label: "First TP", price: trade.planned_first_tp, type: "tp1" });
    levels.push({ label: "Entry", price: trade.planned_entry, type: "entry" });
    levels.push({ label: "SL", price: trade.planned_sl, type: "sl" });
  }

  function dotColor(item: LevelItem) {
    if (item.type === "entry") return "var(--lucid-accent)";
    if (item.type === "sl") return "var(--lucid-ink-3)";
    return "var(--lucid-ink-3)";
  }

  function labelColor(item: LevelItem) {
    if (item.type === "entry") return "var(--lucid-accent)";
    if (item.type === "sl") return "var(--lucid-ink-3)";
    if (item.type === "tp_main") return "var(--lucid-pos)";
    return "var(--lucid-ink-2)";
  }

  return (
    <div className="flex flex-col gap-0 my-1">
      {levels.map((lvl, i) => (
        <div key={i} className="flex items-center gap-3">
          <span style={{ fontSize: 11, color: labelColor(lvl), width: 60, textAlign: "right", flexShrink: 0 }}>
            {lvl.label}
          </span>
          <div className="flex flex-col items-center" style={{ width: 16 }}>
            {i > 0 && <div style={{ width: 2, height: 14, background: "var(--lucid-line)" }} />}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: dotColor(lvl),
                border: lvl.type === "entry" ? "none" : "1px solid var(--lucid-line-2)",
                flexShrink: 0,
              }}
            />
            {i < levels.length - 1 && <div style={{ width: 2, height: 14, background: "var(--lucid-line)" }} />}
          </div>
          <span className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink)", fontVariantNumeric: "tabular-nums" }}>
            {lvl.price}
          </span>
        </div>
      ))}
    </div>
  );
}

function Section({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div className="lx-content-section" style={first ? { borderTop: "none", paddingTop: 0 } : undefined}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="lx-eyebrow" style={{ marginBottom: 12 }}>{children}</p>;
}

function kv(label: string, value: React.ReactNode) {
  return (
    <div className="lx-content-row">
      <span className="lx-content-row-label">{label}</span>
      <span className="lx-content-row-value">{value}</span>
    </div>
  );
}

// ── Main drawer component ─────────────────────────────────────────────────────
export function PlannedDrawerContent({
  trade,
  onConvert,
  onMarkInvalidated,
}: {
  trade: PlannedTrade;
  onConvert: (t: PlannedTrade) => void;
  onMarkInvalidated: (t: PlannedTrade) => void;
}) {
  const config = pairs.find(p => p.symbol === trade.pair);
  const rr = calcRR(trade);
  const dist = getDistanceToEntry(trade);
  const canConvert = trade.status === "Watching" || trade.status === "Ready";
  const isNearTrigger = trade.status === "Ready" && dist.pips <= 10;

  return (
    <div className="flex flex-col pb-6">
      {/* Header block */}
      <Section first>
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {config && (
                <span style={{ fontSize: 18, lineHeight: 1 }}>
                  {config.flag_a}{config.flag_b}
                </span>
              )}
              <span className="lx-heading" style={{ fontSize: 18 }}>
                {config?.display_name ?? trade.pair}
              </span>
              <ModelPill model={trade.model} />
            </div>
            <div className="flex items-center gap-2">
              <span
                className="lx-value"
                style={{
                  fontWeight: 600,
                  color: trade.direction === "Buy" ? "var(--lucid-pos)" : "var(--lucid-neg)",
                }}
              >
                {trade.direction === "Buy" ? "↑" : "↓"} {trade.direction}
              </span>
              <StatusPill status={trade.status} />
            </div>
          </div>
          <ConvictionPill conviction={trade.conviction} />
        </div>
      </Section>

      {/* Setup */}
      <Section>
        <SectionTitle>Setup Levels</SectionTitle>
        <PlannedLadder trade={trade} />
        <div className="lx-rows" style={{ marginTop: 12 }}>
          {kv("R:R Plan", <span className="lx-value" style={{ color: rr >= 2 ? "var(--lucid-pos)" : "var(--lucid-ink)", fontWeight: 600 }}>{rr.toFixed(2)}R</span>)}
          {kv("Planned Risk", <span className="lx-value">{`${trade.planned_risk_pct}%`}</span>)}
        </div>
      </Section>

      {/* Distance */}
      <Section>
        <SectionTitle>Distance to Entry</SectionTitle>
        <div className="flex flex-col gap-1 mb-3">
          <DistanceBadge trade={trade} large />
          <p className="lx-value" style={{ fontSize: 12, color: "var(--lucid-ink-3)", marginTop: 4 }}>
            Current: {trade.current_market_price} · Planned: {trade.planned_entry}
          </p>
        </div>
        {isNearTrigger && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: "var(--lucid-warn-bg)", border: "1px solid var(--lucid-warn-bd)" }}
          >
            <span style={{ fontSize: 14 }}>⚠</span>
            <span style={{ fontSize: 12, color: "var(--lucid-warn)", fontWeight: 500 }}>
              Setup approaching trigger zone.
            </span>
          </div>
        )}
      </Section>

      {/* Notes */}
      {trade.notes && (
        <Section>
          <SectionTitle>Notes</SectionTitle>
          <p className="lx-body">{trade.notes}</p>
        </Section>
      )}

      {/* Screenshots */}
      {trade.screenshots.length > 0 && (
        <Section>
          <SectionTitle>Screenshots</SectionTitle>
          <ScreenshotGallery urls={trade.screenshots} tileHeight={150} />
        </Section>
      )}

      {/* Added date */}
      <p className="lx-micro" style={{ marginTop: 16 }}>
        Added {new Date(trade.date_added).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
      </p>

      {/* Actions — normal flow inside the drawer body, same position other
          drawer contents use for their bottom actions (in-flow, not fixed to
          the viewport: `position: fixed` here was establishing its containing
          block against the browser window instead of the drawer panel, since
          this content renders nested inside DetailDrawer's scrollable body —
          that's what let it float free of the drawer). */}
      {(canConvert || (trade.status !== "Invalidated" && trade.status !== "Cancelled")) && (
        <div className="flex items-center gap-3" style={{ marginTop: 20 }}>
          {canConvert && (
            <button onClick={() => onConvert(trade)} className="lx-btn lx-btn-primary flex-1">
              Convert to Live Trade
            </button>
          )}
          {trade.status !== "Invalidated" && trade.status !== "Cancelled" && (
            <button onClick={() => onMarkInvalidated(trade)} className="lx-btn lx-btn-secondary">
              Mark Invalidated
            </button>
          )}
        </div>
      )}
    </div>
  );
}
