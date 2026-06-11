import type { Trade } from './demo-data';

// Win rate excludes BE trades from denominator: WR = wins / (wins + losses)
function calcWR(filteredTrades: Trade[]): number | null {
  const closed = filteredTrades.filter((t) => t.date_closed !== '');
  const wins = closed.filter((t) => t.blended_rr > 0).length;
  const losses = closed.filter((t) => t.blended_rr < 0).length;
  if (wins + losses === 0) return null;
  return wins / (wins + losses);
}

// Expectancy = (WR × AvgWin) - (LR × AvgLoss)
function calcExpectancy(filteredTrades: Trade[]): number | null {
  const closed = filteredTrades.filter((t) => t.date_closed !== '');
  const wins = closed.filter((t) => t.blended_pnl > 0);
  const losses = closed.filter((t) => t.blended_pnl < 0);
  const wr = calcWR(filteredTrades);
  if (wr === null) return null;
  const lr = 1 - wr;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.blended_pnl, 0) / wins.length : 0;
  const avgLoss =
    losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.blended_pnl, 0) / losses.length) : 0;
  return wr * avgWin - lr * avgLoss;
}

// ---

export interface ModelStats {
  wr: number | null;         // 0-1 or null
  rr: number | null;         // avg blended_rr of winning closed trades
  trade_count: number;
  expectancy: number | null;
  net_pnl: number;
  best_pair: string | null;  // pair with highest net P&L for this model
}

export function getModelStats(allTrades: Trade[], modelName: string): ModelStats {
  const modelTrades = allTrades.filter((t) => t.model === modelName);

  const wr = calcWR(modelTrades);

  const closedWins = modelTrades.filter((t) => t.date_closed !== '' && t.blended_rr > 0);
  const rr =
    closedWins.length > 0
      ? closedWins.reduce((s, t) => s + t.blended_rr, 0) / closedWins.length
      : null;

  const trade_count = modelTrades.filter((t) => t.date_closed !== '').length;
  const expectancy = calcExpectancy(modelTrades);
  const net_pnl = modelTrades
    .filter((t) => t.date_closed !== '')
    .reduce((s, t) => s + t.blended_pnl, 0);

  // Best pair: highest net P&L per pair for this model
  const pairPnlMap = new Map<string, number>();
  for (const t of modelTrades.filter((t) => t.date_closed !== '')) {
    pairPnlMap.set(t.pair, (pairPnlMap.get(t.pair) ?? 0) + t.blended_pnl);
  }
  let best_pair: string | null = null;
  let bestPnl = -Infinity;
  for (const [pair, pnl] of pairPnlMap) {
    if (pnl > bestPnl) {
      bestPnl = pnl;
      best_pair = pair;
    }
  }

  return { wr, rr, trade_count, expectancy, net_pnl, best_pair };
}

// ---

export interface PairStats {
  wr: number | null;
  trade_count: number;
  net_pnl: number;
  best_model: string | null;   // model with highest net P&L for this pair
  worst_model: string | null;  // model with lowest net P&L for this pair
}

export function getPairStats(allTrades: Trade[], symbol: string): PairStats {
  const pairTrades = allTrades.filter((t) => t.pair === symbol);
  const wr = calcWR(pairTrades);
  const trade_count = pairTrades.filter((t) => t.date_closed !== '').length;
  const net_pnl = pairTrades
    .filter((t) => t.date_closed !== '')
    .reduce((s, t) => s + t.blended_pnl, 0);

  // Best/worst model by net P&L on this pair
  const modelPnlMap = new Map<string, number>();
  for (const t of pairTrades.filter((t) => t.date_closed !== '')) {
    modelPnlMap.set(t.model, (modelPnlMap.get(t.model) ?? 0) + t.blended_pnl);
  }
  let best_model: string | null = null;
  let worst_model: string | null = null;
  let bestPnl = -Infinity;
  let worstPnl = Infinity;
  for (const [model, pnl] of modelPnlMap) {
    if (pnl > bestPnl) { bestPnl = pnl; best_model = model; }
    if (pnl < worstPnl) { worstPnl = pnl; worst_model = model; }
  }
  // If only one model, worst = same as best
  if (modelPnlMap.size === 1) worst_model = best_model;

  return { wr, trade_count, net_pnl, best_model, worst_model };
}

// ---

export interface SessionStats {
  wr: number | null;
  trade_count: number;
  avg_pnl: number | null;
  best_pair: string | null;
}

export function getSessionStats(allTrades: Trade[], session: string): SessionStats {
  const sessionTrades = allTrades.filter((t) => t.session === session);
  const wr = calcWR(sessionTrades);
  const closed = sessionTrades.filter((t) => t.date_closed !== '');
  const trade_count = closed.length;
  const avg_pnl = closed.length > 0 ? closed.reduce((s, t) => s + t.blended_pnl, 0) / closed.length : null;

  const pairPnlMap = new Map<string, number>();
  for (const t of closed) {
    pairPnlMap.set(t.pair, (pairPnlMap.get(t.pair) ?? 0) + t.blended_pnl);
  }
  let best_pair: string | null = null;
  let bestPnl = -Infinity;
  for (const [pair, pnl] of pairPnlMap) {
    if (pnl > bestPnl) { bestPnl = pnl; best_pair = pair; }
  }

  return { wr, trade_count, avg_pnl, best_pair };
}

// Total closed trades count (used for session bar proportion)
export function getTotalClosedTradeCount(allTrades: Trade[]): number {
  return allTrades.filter((t) => t.date_closed !== '').length;
}
