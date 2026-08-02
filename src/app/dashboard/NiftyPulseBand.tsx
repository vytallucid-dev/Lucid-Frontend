"use client";

import Link from "next/link";
import type { PublicScorecard } from "@/lib/api/nifty";
import { Sparkline } from "@/components/Sparkline";
import { bandColor, bandBg, netDisplay } from "@/app/nifty/nifty-utils";
import { NiftyPulseSkeleton } from "./DashboardSkeletons";

// ─── NIFTY pulse helpers ──────────────────────────────────────────────────────
// Moved verbatim from FundamentalBiasPanel.tsx (Step 5) — every field the
// pulse card showed (flag, "NIFTY 50 Macro", band name+colour, Net/Domestic/
// External, sparkline, "View scorecard →") is unchanged. Per B5, this card
// keeps every field it shows today; NIFTY's field orb does not replace it —
// it now lives in its own band directly below the hero instead of inside the
// Fundamental Bias card, since that card's layout was replaced by the field.

function NiftyMetric({ label, value, color, big }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="lx-eyebrow">{label}</span>
      <span className={big ? "lx-metric" : "lx-metric-sm"} style={{ color: color ?? "var(--lucid-ink)" }}>
        {value}
      </span>
    </div>
  );
}

function NiftyPulseCard({ latest, history }: { latest: PublicScorecard; history: number[] }) {
  const color = bandColor(latest.band);
  return (
    <Link
      href="/nifty/scorecard"
      className="lx-card lx-card-interactive block"
      style={{
        background: `linear-gradient(115deg, ${bandBg(latest.band)} 0%, transparent 55%), var(--lucid-surface)`,
        textDecoration: "none",
      }}
    >
      <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
        {/* Identity */}
        <div className="flex items-center gap-2.5">
          <span style={{ fontSize: 22 }}>🇮🇳</span>
          <div className="flex flex-col gap-1.5">
            <span className="lx-eyebrow">NIFTY 50 Macro</span>
            <p className="lx-heading" style={{ color }}>{latest.band}</p>
          </div>
        </div>

        {/* Composite metrics */}
        <div className="flex items-center gap-10">
          <NiftyMetric label="Net" value={netDisplay(latest.net_score)} color={color} big />
          <NiftyMetric label="Domestic" value={netDisplay(latest.domestic_composite)} />
          <NiftyMetric label="External" value={netDisplay(latest.external_composite)} />
        </div>

        {/* Trend + CTA */}
        <div className="flex items-center gap-4 ml-auto">
          {history.length >= 2 && <Sparkline data={history} width={100} height={32} />}
          <span className="lx-micro" style={{ whiteSpace: "nowrap" }}>View scorecard →</span>
        </div>
      </div>
    </Link>
  );
}

export function NiftyPulseBand({
  niftyLatestLoading,
  niftyLatest,
  niftyHistory,
}: {
  niftyLatestLoading: boolean;
  niftyLatest: PublicScorecard | undefined;
  niftyHistory: number[];
}) {
  return (
    <section>
      <div className="lx-band-head">
        <div className="lx-eyebrow">NIFTY Macro Pulse</div>
        <h2 className="lx-heading">Where the index leans</h2>
      </div>

      {niftyLatestLoading ? (
        // Same card, same height, same internal rhythm — so the real pulse card
        // replaces it without moving the band below.
        <NiftyPulseSkeleton />
      ) : niftyLatest ? (
        <NiftyPulseCard latest={niftyLatest} history={niftyHistory} />
      ) : (
        <Link
          href="/nifty/scorecard"
          className="lx-card lx-card-interactive block"
          style={{ textDecoration: "none" }}
        >
          <p className="lx-body">
            🇮🇳 NIFTY macro scorecard not available yet — <span style={{ color: "var(--lucid-ink)" }}>open the scorecard →</span>
          </p>
        </Link>
      )}
    </section>
  );
}
