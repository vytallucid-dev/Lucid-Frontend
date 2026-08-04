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
import { isTradeOpen, getPrimaryExecution } from "@/lib/trade-helpers";
import { edgeRollingWinRate } from "@/lib/stats";
import type { LivePosition } from "./LivePositionsBand";
import {
  useTrades,
  usePlanned,
  useAccounts,
  useTradingPairs,
  useDeleteTrade,
  useUpdatePlanned,
} from "@/hooks/useTrading";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorState } from "@/components/state/ErrorState";
import { useDelayedFlag } from "@/components/state/Skeleton";
import {
  PerformanceBandSkeleton,
  LivePositionsSkeleton,
  PlannedBandSkeleton,
  AccountsBandSkeleton,
} from "./DashboardSkeletons";
import { useAuth } from "@/lib/auth/auth-context";
import { DetailDrawer } from "@/components/DetailDrawer";
import { TradeDrawerContent } from "@/app/trading/journal/TradeDrawerContent";
import { AccountDrawerContent } from "@/app/trading/accounts/AccountDrawerContent";
import { PlannedDrawerContent } from "@/app/trading/planned/PlannedDrawerContent";
import { AddTradeModal } from "@/app/trading/journal/AddTradeModal";
import { toast } from "@/components/toast";
import { useQuery } from "@tanstack/react-query";
import { usePrefersReducedMotion } from "@/components/motion";
import { useAssets } from "@/hooks/useAssets";
import { getLatestScorecard, getScorecardHistory } from "@/lib/api/nifty";

import {
  getGreeting,
  applyDateFilter,
  buildPnlCurve,
  computeDrawdownWindows,
  buildStatusLine,
  type DateRangePreset,
} from "./dashboard-helpers";
import { useValueFlash, useNewIds } from "./useDashboardAnimations";
import { CashFlowModal } from "./CashFlowModal";
import { HeroBand } from "./HeroBand";
import { QuickStrip } from "./QuickStrip";
import { LivePositionsBand } from "./LivePositionsBand";
import { TodayBand } from "./TodayBand";
import { PerformanceBand } from "./PerformanceBand";
import { PlannedBand } from "./PlannedBand";
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
  const [convertPlanned, setConvertPlanned] = useState<PlannedTrade | null>(null);
  const deleteTrade = useDeleteTrade();
  const updatePlannedM = useUpdatePlanned();

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
  // Same hook, same ['oracle','assets'] query key the Oracle pages call — the
  // alignment field's orb list (which instruments Oracle currently scores) and
  // its per-orb score both come from here now, replacing the previous
  // fxPairsQuery + goldQuery pair that only ever fed the field.
  const assetsQuery = useAssets();
  const niftyLatestQuery = useQuery({ queryKey: ["nifty", "scorecard", "latest"], queryFn: getLatestScorecard });
  const niftyHistoryQuery = useQuery({
    queryKey: ["nifty", "scorecard", "history-lite", 30],
    queryFn: () => getScorecardHistory({ includeBreakdown: false, limit: 30 }),
  });

  const allTrades = useMemo(() => tradesQuery.data ?? [], [tradesQuery.data]);
  const allPlanned = useMemo(() => plannedQuery.data ?? [], [plannedQuery.data]);
  const allAccounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const pairs = useMemo(() => pairsQuery.data ?? [], [pairsQuery.data]);

  // NIFTY net-score trend (oldest → newest) for the pulse sparkline.
  const niftyHistory = useMemo(
    () => [...(niftyHistoryQuery.data ?? [])].map((s) => s.net_score).reverse(),
    [niftyHistoryQuery.data],
  );

  const isLoading = tradesQuery.isLoading || accountsQuery.isLoading || plannedQuery.isLoading;
  const loadError = tradesQuery.error || accountsQuery.error || plannedQuery.error;
  const showBandSkeletons = useDelayedFlag(isLoading, 100);

  // Greeting (computed on render from IST time)
  const greeting = getGreeting();

  // Live Positions band is execution-level: one card per open ACCOUNT FILL,
  // not per idea — the same idea open in two accounts is two cards, since
  // each account carries its own risk/lot/entry and its own open exposure.
  const livePositions = useMemo<LivePosition[]>(
    () =>
      allTrades.flatMap((trade) =>
        trade.executions.filter((e) => e.date_closed === "").map((execution) => ({ trade, execution })),
      ),
    [allTrades],
  );
  // Ideas whose PRIMARY execution is still open — the idea-level "is this
  // still running" question (edge outcome isn't decided yet).
  const liveIdeas = useMemo(() => allTrades.filter(isTradeOpen), [allTrades]);
  const activePlanned = useMemo(
    () => allPlanned.filter((p) => p.status === "Watching" || p.status === "Ready"),
    [allPlanned]
  );
  const readyCount = useMemo(() => allPlanned.filter((p) => p.status === "Ready").length, [allPlanned]);

  // A5 — the alignment field marks pairs with an open position: any account
  // still holding an open fill in that pair, not just the primary.
  const livePairSymbols = useMemo(() => new Set(livePositions.map((p) => p.trade.pair)), [livePositions]);

  // Living feedback — newly arrived rows get a one-shot gold highlight.
  const newLiveIds = useNewIds(useMemo(() => livePositions.map((p) => p.execution.id), [livePositions]), !isLoading);
  const newPlannedIds = useNewIds(useMemo(() => activePlanned.map((p) => p.id), [activePlanned]), !isLoading);

  const accountNames = useMemo(() => new Map(allAccounts.map((a) => [a.id, a.account_name])), [allAccounts]);

  // Status line — type-agnostic, framed off whatever accounts exist
  const statusLine = useMemo(
    () => buildStatusLine(allAccounts, readyCount, liveIdeas.length),
    [allAccounts, readyCount, liveIdeas.length],
  );

  // Metric cards
  const metrics = useMemo(() => {
    const activeAccounts = allAccounts.filter((a) => a.status === "Active");
    const managed = managedCapital(allAccounts);
    const evaluation = evaluationCapital(allAccounts);
    const overallPnl = allAccounts.reduce((s, a) => s + accountTradingPnl(a), 0);
    const activeCount = activeAccounts.length;

    // Edge statistic: last 20 IDEAS to close (by primary execution), not the
    // last 20 rows — one idea logged to three accounts is still one slot.
    const { winRate, count } = edgeRollingWinRate(allTrades, 20);
    const wr = (winRate ?? 0) * 100;

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
      tradeCount: count,
      hasProp: propAccounts.length > 0,
      challengesActive,
      bestName: best?.account_name ?? "—",
      bestPct: best ? pnlPct(best) * 100 : 0,
    };
  }, [allAccounts, allTrades]);

  // ── The two presentational aggregations this redesign needs. Both are plain
  // reductions over the already-fetched trade list — no new query, no new
  // trade statistic, nothing that feeds any existing figure. They exist only
  // because the new band headers state them.
  const openRiskPct = useMemo(
    () => livePositions.reduce((s, p) => s + (p.execution.risk_pct ?? 0), 0),
    [livePositions],
  );
  const tradesThisMonth = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    return allTrades.filter((t) => {
      const d = new Date(t.date_opened);
      return d.getMonth() === m && d.getFullYear() === y;
    }).length;
  }, [allTrades]);

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
          oracleAssets={assetsQuery.data}
          niftyNetScore={niftyLatestQuery.data?.net_score ?? null}
          livePairSymbols={livePairSymbols}
          assetsLoading={assetsQuery.isLoading}
          onNavigate={(href) => router.push(href)}
        />
      </div>

      {/* Everything below the hero shares one container (1440px, 40px gutters
          at desktop) and one 64px band rhythm, with a container-width hairline
          between bands — except the Today band, which is full-bleed on purpose
          and re-establishes the container inside itself. */}

      {/* ── Band 1: Quick strip — slim by design, the thin bar that makes the
          band beneath it read as heavy. ───────────────────────────────────── */}
      <div className="lx-container">
        <div className="dash-band-slim">
          <QuickStrip
            chatValue={chatValue}
            onChatChange={setChatValue}
            onChatSubmit={handleChatSubmit}
            onLogTrade={() => setShowAddTrade(true)}
            onCashFlow={() => setShowCashFlow(true)}
            onViewPlanned={() => router.push("/trading/planned")}
            onOpenScanner={() => router.push("/oracle")}
            tradesThisMonth={tradesThisMonth}
          />
        </div>
        <div className="lx-rule" />
      </div>

      {/* ── Band 2: Live positions — the heavy band. ───────────────────────── */}
      <div className="lx-container">
        {isLoading ? (
          showBandSkeletons ? (
            <div className="dash-band"><LivePositionsSkeleton /></div>
          ) : null
        ) : loadError ? (
          <div className="dash-band">
            <ErrorState
              error={loadError}
              onRetry={() => { tradesQuery.refetch(); accountsQuery.refetch(); plannedQuery.refetch(); }}
              title="Couldn't load your dashboard"
            />
          </div>
        ) : (
          <div className="dash-band">
            <LivePositionsBand
              livePositions={livePositions}
              pairsConfig={pairsConfig}
              accountNames={accountNames}
              newLiveIds={newLiveIds}
              openRiskPct={openRiskPct}
              onTradeClick={setTradeDrawer}
              reducedMotion={reducedMotion}
            />
          </div>
        )}
      </div>

      {/* ── Band 3: Today — full-bleed breath on the deep ground. Escapes the
          container deliberately and re-establishes it inside. ─────────────── */}
      <div className="dash-bleed">
        <div className="lx-container">
          <TodayBand
            niftyLatestLoading={niftyLatestQuery.isLoading}
            niftyLatest={niftyLatestQuery.data}
            niftyHistory={niftyHistory}
          />
        </div>
      </div>

      <div className="lx-container">
        {isLoading ? (
          // Each band keeps its own height while loading, so the bands below
          // arrive in place rather than pushing the page around. Held back
          // ~100ms so a warm cache never flashes a skeleton.
          showBandSkeletons ? (
            <>
              <div className="dash-band"><PerformanceBandSkeleton /></div>
              <div className="lx-rule" />
              <div className="dash-band"><PlannedBandSkeleton /></div>
              <div className="lx-rule" />
              <div className="dash-band"><AccountsBandSkeleton /></div>
            </>
          ) : null
        ) : loadError ? null : (
        <>
        {/* ── Band 4: Performance ─────────────────────────────────────────── */}
        <div className="dash-band">
          <PerformanceBand
            curveData={curveData}
            drawdownWindows={drawdownWindows}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            reducedMotion={reducedMotion}
          />
        </div>

        <div className="lx-rule" />

        {/* ── Band 5: Planned ─────────────────────────────────────────────── */}
        <div className="dash-band">
          <PlannedBand
            activePlanned={activePlanned}
            readyCount={readyCount}
            pairsConfig={pairsConfig}
            newPlannedIds={newPlannedIds}
            onPlannedClick={setPlannedDrawer}
            reducedMotion={reducedMotion}
          />
        </div>

        <div className="lx-rule" />

        {/* ── Band 6: Capital ─────────────────────────────────────────────── */}
        <div className="dash-band" style={{ paddingBottom: 120 }}>
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
      {/* Convert planned → live, prefilled — mirrors /trading/planned's own
          conversion flow exactly (this used to open a blank form here). */}
      {convertPlanned && (
        <AddTradeModal
          open={!!convertPlanned}
          prefill={{
            pair: convertPlanned.pair,
            model: convertPlanned.model,
            direction: convertPlanned.direction,
            planned_entry: convertPlanned.planned_entry,
            planned_sl: convertPlanned.planned_sl,
            planned_first_tp: convertPlanned.planned_first_tp,
            planned_main_tp: convertPlanned.planned_main_tp,
            risk_pct: convertPlanned.planned_risk_pct,
            conviction: convertPlanned.conviction,
          }}
          onSubmitted={() => {
            const cp = convertPlanned;
            if (!cp) return;
            updatePlannedM.mutate({
              id: cp.id,
              body: {
                status: "Cancelled",
                notes: (cp.notes ? cp.notes + "\n" : "") + "[Converted to Live Trade]",
              },
            });
          }}
          onClose={() => setConvertPlanned(null)}
        />
      )}
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
              setConvertPlanned(plannedDrawer);
              setPlannedDrawer(null);
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
            trades={allTrades}
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
