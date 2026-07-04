"use client";

import { useRouter } from "next/navigation";
import { Waves, Gauge, TrendingDown, DollarSign, LineChart, Lock, type LucideIcon } from "lucide-react";
import { DetailDrawer } from "@/components/DetailDrawer";

interface NiftyToolsDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenFlowTracker: () => void;
}

function ToolRow({
  title,
  description,
  icon: Icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="lt-card lt-lift w-full flex items-start gap-3 p-4 text-left"
    >
      <div
        className="shrink-0 flex items-center justify-center w-9 h-9 rounded-md"
        style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)" }}
      >
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="lt-serif text-sm font-semibold" style={{ color: "var(--lucid-ink)" }}>
          {title}
        </p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>
          {description}
        </p>
      </div>
    </button>
  );
}

function DeferredToolRow({ title, description, reason }: { title: string; description: string; reason: string }) {
  return (
    <div
      className="w-full flex items-start gap-3 p-4 rounded-lg opacity-50 cursor-not-allowed"
      style={{ background: "var(--lucid-surface)", border: "1px solid var(--lucid-line)" }}
      title={reason}
    >
      <div
        className="shrink-0 flex items-center justify-center w-9 h-9 rounded-md"
        style={{ background: "var(--lucid-surface-3)", color: "var(--lucid-ink-3)" }}
      >
        <Lock size={15} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="lt-serif text-sm font-semibold" style={{ color: "var(--lucid-ink-2)" }}>
            {title}
          </p>
          <span
            className="lt-eyebrow px-1.5 py-0.5 rounded"
            style={{ background: "var(--lucid-surface-3)", fontSize: 9 }}
          >
            Coming soon
          </span>
        </div>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>
          {description}
        </p>
      </div>
    </div>
  );
}

export function NiftyToolsDrawer({ open, onClose, onOpenFlowTracker }: NiftyToolsDrawerProps) {
  const router = useRouter();

  const navigate = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <DetailDrawer open={open} onClose={onClose} title="NIFTY Tools">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="lt-eyebrow">
            Flow &amp; Positioning
            <span className="lt-eyebrow-ln" />
          </div>
          <ToolRow
            title="Flow Tracker"
            description="FII cash flow vs DII absorption vs FII futures positioning — did domestic money absorb the selling?"
            icon={Waves}
            onClick={onOpenFlowTracker}
          />
          <DeferredToolRow
            title="Score vs Price"
            description="Net score overlaid on NIFTY spot — needs the price series ingested first."
            reason="niftyClose is not yet populated — requires a backend ingestion pass."
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="lt-eyebrow">
            Diagnostics
            <span className="lt-eyebrow-ln" />
          </div>
          <ToolRow
            title="Velocity"
            description="Net-score change per day, anchor-to-anchor, with trajectory."
            icon={Gauge}
            onClick={() => navigate("/nifty/velocity")}
          />
          <ToolRow
            title="V-Bottom"
            description="Real V-bottoms vs counter-trend bounces, via Ind 9 raw at the trough."
            icon={TrendingDown}
            onClick={() => navigate("/nifty/v-bottom")}
          />
          <ToolRow
            title="USD Lab"
            description="The texture behind Indicator 9 — every sub-indicator, cluster and threshold."
            icon={DollarSign}
            onClick={() => navigate("/nifty/usd-lab")}
          />
        </div>
      </div>
    </DetailDrawer>
  );
}
