"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  accountTradingPnl,
  isPropAccount,
  type Trade,
  type PlannedTrade,
  type Account,
} from "@/lib/demo-data";
import { managedCapital, evaluationCapital } from "@/lib/account-capital";
import {
  useTrades,
  usePlanned,
  useAccounts,
  useTradingPairs,
  useDeleteTrade,
} from "@/hooks/useTrading";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { useAuth } from "@/lib/auth/auth-context";
import { DetailDrawer } from "@/components/DetailDrawer";
import { TradeDrawerContent } from "@/app/trading/journal/TradeDrawerContent";
import { AccountDrawerContent } from "@/app/trading/accounts/AccountDrawerContent";
import { PlannedDrawerContent } from "@/app/trading/planned/PlannedDrawerContent";
import { AddTradeModal } from "@/app/trading/journal/AddTradeModal";
import { toast } from "@/components/toast";
import { useQuery } from "@tanstack/react-query";
import { usePrefersReducedMotion } from "@/components/motion";
import { getAllFxPairs, getScorecardAsset } from "@/lib/api/oracle";
import { getLatestScorecard, getScorecardHistory } from "@/lib/api/nifty";

import {
  getGreeting,
  applyDateFilter,
  buildPnlCurve,
  computeDrawdownWindows,
  buildStatusLine,
  type DateRangePreset,
  type PairBias,
} from "./dashboard-helpers";
import { useValueFlash, useNewIds } from "./useDashboardAnimations";
import { CashFlowModal } from "./CashFlowModal";
import { HeroBand } from "./HeroBand";
import { QuickActionsBand } from "./QuickActionsBand";
import { NiftyPulseBand } from "./NiftyPulseBand";
import { PerformanceBand } from "./PerformanceBand";
import { OpenWorkBand } from "./OpenWorkBand";
import { AccountsBand } from "./AccountsBand";

// ─── Main Dashboard ───────────────────────────────────────────────────────────
// Rebuilt into four scrollable bands (Step 5). Every hook, query, memo, and
// handler below is unchanged from the pre-rebuild page.tsx — only the JSX at
// the bottom of the component (what renders, and in what arrangement) moved
// into the band components imported above.

export default function DashboardPage() {
  const router = useRouter();
  const { dbUser } = useAuth();
  // First name for the greeting; falls back gracefully when the name isn't set.
  const firstName = dbUser?.name?.trim().split(/\s+/)[0] ?? "";

  // Drawer state
  const [tradeDrawer, setTradeDrawer] = useState<Trade | null>(null);
  const [plannedDrawer, setPlannedDrawer] = useState<PlannedTrade | null>(null);
  const [accountDrawer, setAccountDrawer] = useState<Account | null>(null);

  // Modal state
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [showCashFlow, setShowCashFlow] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [pendingDeleteTrade, setPendingDeleteTrade] = useState<Trade | null>(null);
  const deleteTrade = useDeleteTrade();

  // Chat input
  const [chatValue, setChatValue] = useState("");

  // Respect reduced-motion for the (recharts) chart draw-in.
  const reducedMotion = usePrefersReducedMotion();

  // P&L curve date range
  const [dateRange, setDateRange] = useState<DateRangePreset>("All Time");

  // Live data
  const tradesQuery = useTrades();
  const plannedQuery = usePlanned();
  const accountsQuery = useAccounts();
  const pairsQuery = useTradingPairs();

  // Fundamental bias (Oracle) + NIFTY macro pulse — independent of trading data.
  const fxPairsQuery = useQuery({ queryKey: ["oracle", "fx-scorecard", "__all__"], queryFn: getAllFxPairs });
  // Gold is an asset (not an FX pair). The /scorecard endpoint is single-asset
  // (asset= is required), so fetch Gold directly rather than as an "all" call.
  const goldQuery = useQuery({ queryKey: ["oracle", "scorecard", "Gold"], queryFn: () => getScorecardAsset("Gold") });
  const niftyLatestQuery = useQuery({ queryKey: ["nifty", "scorecard", "latest"], queryFn: getLatestScorecard });
  const niftyHistoryQuery = useQuery({
    queryKey: ["nifty", "scorecard", "history-lite", 30],
    queryFn: () => getScorecardHistory({ includeBreakdown: false, limit: 30 }),
  });

  const allTrades = useMemo(() => tradesQuery.data ?? [], [tradesQuery.data]);
  const allPlanned = useMemo(() => plannedQuery.data ?? [], [plannedQuery.data]);
  const allAccounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const pairs = useMemo(() => pairsQuery.data ?? [], [pairsQuery.data]);

  // Map each tracked pair's symbol → its fundamental bias. FX majors come from
  // the FX scorecard; XAUUSD maps to the Gold asset scorecard.
  const biasByPair = useMemo(() => {
    const map = new Map<string, PairBias>();
    for (const fx of fxPairsQuery.data ?? []) {
      map.set(fx.key, { bias: fx.bias, score: fx.totalScore, history: fx.scoreHistory });
    }
    const gold = goldQuery.data;
    if (gold) map.set("XAUUSD", { bias: gold.bias, score: gold.totalScore, history: gold.scoreHistory });
    return map;
  }, [fxPairsQuery.data, goldQuery.data]);

  // NIFTY net-score trend (oldest → newest) for the pulse sparkline.
  const niftyHistory = useMemo(
    () => [...(niftyHistoryQuery.data ?? [])].map((s) => s.net_score).reverse(),
    [niftyHistoryQuery.data],
  );
  const biasLoading = fxPairsQuery.isLoading || goldQuery.isLoading;

  const isLoading = tradesQuery.isLoading || accountsQuery.isLoading || plannedQuery.isLoading;
  const loadError = tradesQuery.error || accountsQuery.error || plannedQuery.error;

  // Greeting (computed on render from IST time)
  const greeting = getGreeting();

  // Live and planned counts
  const liveTrades = useMemo(() => allTrades.filter((t) => t.date_closed === ""), [allTrades]);
  const activePlanned = useMemo(
    () => allPlanned.filter((p) => p.status === "Watching" || p.status === "Ready"),
    [allPlanned]
  );
  const readyCount = useMemo(() => allPlanned.filter((p) => p.status === "Ready").length, [allPlanned]);

  // A5 — the alignment field marks pairs with an open position, reusing the
  // exact same "open trade" identification the Live Trades band already uses
  // (t.date_closed === "") and the same pair-identifier field (t.pair, the
  // symbol) already matched against elsewhere on this page.
  const livePairSymbols = useMemo(() => new Set(liveTrades.map((t) => t.pair)), [liveTrades]);

  // Living feedback — newly arrived rows get a one-shot gold highlight.
  const newLiveIds = useNewIds(useMemo(() => liveTrades.map((t) => t.id), [liveTrades]), !isLoading);
  const newPlannedIds = useNewIds(useMemo(() => activePlanned.map((p) => p.id), [activePlanned]), !isLoading);

  // Status line — type-agnostic, framed off whatever accounts exist
  const statusLine = useMemo(
    () => buildStatusLine(allAccounts, readyCount, liveTrades.length),
    [allAccounts, readyCount, liveTrades.length],
  );

  // Metric cards
  const metrics = useMemo(() => {
    const activeAccounts = allAccounts.filter((a) => a.status === "Active");
    const managed = managedCapital(allAccounts);
    const evaluation = evaluationCapital(allAccounts);
    const overallPnl = allAccounts.reduce((s, a) => s + accountTradingPnl(a), 0);
    const activeCount = activeAccounts.length;

    const closedSorted = [...allTrades.filter((t) => t.date_closed !== "")].sort(
      (a, b) => new Date(b.date_closed).getTime() - new Date(a.date_closed).getTime()
    );
    const last20 = closedSorted.slice(0, 20);
    // Outcome decided by manual net P&L (blended_pnl), matching the journal.
    const wins = last20.filter((t) => t.blended_pnl > 0);
    const losses = last20.filter((t) => t.blended_pnl < 0);
    const wr = wins.length + losses.length > 0 ? (wins.length / (wins.length + losses.length)) * 100 : 0;

    // Adaptive 4th metric: challenges if any prop accounts exist, else best performer.
    const propAccounts = allAccounts.filter(isPropAccount);
    const challengesActive = propAccounts.filter(
      (a) => a.status === "Active" && (a.stage === "Stage 1" || a.stage === "Stage 2"),
    ).length;
    const pnlPct = (a: Account) => (a.account_size > 0 ? accountTradingPnl(a) / a.account_size : 0);
    const best = [...allAccounts].sort((a, b) => pnlPct(b) - pnlPct(a))[0] ?? null;

    return {
      managedCapital: managed,
      evaluationCapital: evaluation,
      overallPnl,
      activeCount,
      wr,
      tradeCount: last20.length,
      hasProp: propAccounts.length > 0,
      challengesActive,
      bestName: best?.account_name ?? "—",
      bestPct: best ? pnlPct(best) * 100 : 0,
    };
  }, [allAccounts, allTrades]);

  // Living feedback — metric cards flash their sign color when the value moves
  // (fires on trade add/close/delete via the react-query refetch).
  const pnlFlash = useValueFlash(metrics.overallPnl, !isLoading);
  const wrFlash = useValueFlash(metrics.wr, !isLoading);

  // P&L Curve
  const curveData = useMemo(() => {
    const filtered = applyDateFilter(allTrades, dateRange);
    return buildPnlCurve(filtered);
  }, [allTrades, dateRange]);

  const drawdownWindows = useMemo(() => computeDrawdownWindows(curveData), [curveData]);

  function handleChatSubmit() {
    toast.info("Lucid AI activates with full context of your trading system in Phase 3.", {
      title: "✨ Coming in Phase 3",
    });
  }

  const pairsConfig = pairs;

  return (
    <div className="min-h-screen lt-backdrop" style={{ color: "var(--lucid-ink)", background: "var(--lucid-page-bg)" }}>
      {/* ── Band 1: Hero — full viewport. Shares the same .lx-container as
          every band below, so the hero's left edge and every card's left edge
          sit on one vertical line down the whole page. The alignment field's
          halos and the ambient blobs still overflow it freely. ──────────── */}
      <div className="lx-container">
        <HeroBand
          greeting={greeting}
          firstName={firstName}
          statusLine={statusLine}
          metrics={metrics}
          pnlFlash={pnlFlash}
          wrFlash={wrFlash}
          allAccountsCount={allAccounts.length}
          pairsConfig={pairsConfig}
          biasByPair={biasByPair}
          niftyNetScore={niftyLatestQuery.data?.net_score ?? null}
          livePairSymbols={livePairSymbols}
          biasLoading={biasLoading}
          onNavigate={(href) => router.push(href)}
        />
      </div>

      {/* Every band below shares one container, one vertical rhythm (72px top
          and bottom on desktop, 48px on mobile via --lucid-band-y), and a
          container-width hairline between each. Nothing sets its own width. */}
      <div className="lx-container">

        {/* ── Below the fold: Quick Actions + chat bar ─────────────────────── */}
        <div className="lx-band">
          <QuickActionsBand
            chatValue={chatValue}
            onChatChange={setChatValue}
            onChatSubmit={handleChatSubmit}
            onLogTrade={() => setShowAddTrade(true)}
            onCashFlow={() => setShowCashFlow(true)}
            onViewPlanned={() => router.push("/trading/planned")}
            onOpenScanner={() => router.push("/oracle")}
          />
        </div>

        <div className="lx-rule" />

        {/* ── NIFTY macro pulse — its own band directly below the hero,
            per B5. Its field orb does not replace this card. ─────────────── */}
        <div className="lx-band">
          <NiftyPulseBand
            niftyLatestLoading={niftyLatestQuery.isLoading}
            niftyLatest={niftyLatestQuery.data}
            niftyHistory={niftyHistory}
          />
        </div>

        <div className="lx-rule" />

        {isLoading ? (
          <div className="lx-band">
            <LoadingState stages={["Loading your dashboard…", "Crunching your numbers…", "Preparing charts…"]} />
          </div>
        ) : loadError ? (
          <div className="lx-band">
            <ErrorState
              error={loadError}
              onRetry={() => { tradesQuery.refetch(); accountsQuery.refetch(); plannedQuery.refetch(); }}
              title="Couldn't load your dashboard"
            />
          </div>
        ) : (
        <>
        {/* ── Band 2: Performance ─────────────────────────────────────────── */}
        <div className="lx-band">
          <PerformanceBand
            curveData={curveData}
            drawdownWindows={drawdownWindows}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            reducedMotion={reducedMotion}
          />
        </div>

        <div className="lx-rule" />

        {/* ── Band 3: Open work ───────────────────────────────────────────── */}
        <div className="lx-band">
          <OpenWorkBand
            liveTrades={liveTrades}
            activePlanned={activePlanned}
            readyCount={readyCount}
            pairsConfig={pairsConfig}
            newLiveIds={newLiveIds}
            newPlannedIds={newPlannedIds}
            onTradeClick={setTradeDrawer}
            onPlannedClick={setPlannedDrawer}
            reducedMotion={reducedMotion}
          />
        </div>

        <div className="lx-rule" />

        {/* ── Band 4: Accounts ────────────────────────────────────────────── */}
        <div className="lx-band">
          <AccountsBand
            allAccounts={allAccounts}
            onAccountClick={setAccountDrawer}
            reducedMotion={reducedMotion}
          />
        </div>
        </>
        )}

      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <AddTradeModal open={showAddTrade} onClose={() => setShowAddTrade(false)} />
      <AddTradeModal open={!!editTrade} editTrade={editTrade ?? undefined} onClose={() => setEditTrade(null)} />
      <CashFlowModal open={showCashFlow} onClose={() => setShowCashFlow(false)} />

      <ConfirmDialog
        open={!!pendingDeleteTrade}
        title="Delete trade?"
        message={pendingDeleteTrade ? `This ${pendingDeleteTrade.pair} ${pendingDeleteTrade.direction} trade will be permanently deleted.` : undefined}
        confirmLabel="Delete"
        loading={deleteTrade.isPending}
        onConfirm={() => {
          const t = pendingDeleteTrade;
          if (!t) return;
          deleteTrade.mutate(t.id, {
            onSuccess: () => { toast.success("Trade deleted."); setTradeDrawer(null); },
            onSettled: () => setPendingDeleteTrade(null),
          });
        }}
        onCancel={() => setPendingDeleteTrade(null)}
      />

      {/* ── DetailDrawers ────────────────────────────────────────────────────── */}

      {/* Trade Drawer */}
      <DetailDrawer
        open={tradeDrawer !== null}
        onClose={() => setTradeDrawer(null)}
        title={tradeDrawer ? `Trade #${tradeDrawer.id.slice(0, 8)}` : ""}
        expandHref={tradeDrawer ? `/trading/journal/${tradeDrawer.id}` : undefined}
      >
        {tradeDrawer && (
          <TradeDrawerContent
            trade={tradeDrawer}
            onEdit={() => { setEditTrade(tradeDrawer); setTradeDrawer(null); }}
            onDelete={() => setPendingDeleteTrade(tradeDrawer)}
          />
        )}
      </DetailDrawer>

      {/* Planned Trade Drawer */}
      <DetailDrawer
        open={plannedDrawer !== null}
        onClose={() => setPlannedDrawer(null)}
        title={plannedDrawer ? `${plannedDrawer.pair} ${plannedDrawer.direction}` : ""}
        expandHref={plannedDrawer ? `/trading/planned/${plannedDrawer.id}` : undefined}
      >
        {plannedDrawer && (
          <PlannedDrawerContent
            trade={plannedDrawer}
            onConvert={() => {
              setPlannedDrawer(null);
              setShowAddTrade(true);
            }}
            onMarkInvalidated={() => setPlannedDrawer(null)}
          />
        )}
      </DetailDrawer>

      {/* Account Drawer */}
      <DetailDrawer
        open={accountDrawer !== null}
        onClose={() => setAccountDrawer(null)}
        title={accountDrawer?.account_name ?? ""}
        expandHref={accountDrawer ? `/trading/accounts/${accountDrawer.id}` : undefined}
      >
        {accountDrawer && (
          <AccountDrawerContent
            account={accountDrawer}
            accountTrades={allTrades.filter((t) => t.account_id === accountDrawer.id)}
            onTradeClick={(tradeId) => {
              const t = allTrades.find((tr) => tr.id === tradeId);
              if (!t) return;
              setAccountDrawer(null);
              setTimeout(() => setTradeDrawer(t), 150);
            }}
          />
        )}
      </DetailDrawer>
    </div>
  );
}
