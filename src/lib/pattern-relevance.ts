import type { PublicPattern, PublicScorecard } from '@/lib/api/nifty';

export interface PatternRelevance {
  pattern: PublicPattern;
  relevance_score: number;
  matched_triggers: string[];
}

// Velocity unknown skips all `velocity:*` triggers rather than treating
// unknown as flat. Cleaner than the old normalize-to-0 behavior which
// falsely fired `velocity:flat` whenever the backend hadn't computed
// `velocity_short` yet. The longer-term fix needs backend cooperation
// (patterns declaring `requires_velocity`); until then this keeps unknown
// honest at the cost of suppressing velocity-driven matches on first-load.
export function computePatternRelevance(
  patterns: PublicPattern[],
  scorecard: PublicScorecard,
  velocityShortValue: number | undefined,
  history: PublicScorecard[],
): PatternRelevance[] {
  const velKnown = velocityShortValue !== undefined;

  const activeTriggers = new Set<string>();
  const triggerLabels: Record<string, string> = {};

  // Band
  activeTriggers.add(`band:${scorecard.band}`);
  triggerLabels[`band:${scorecard.band}`] = `Current band: ${scorecard.band}`;

  // Sub-tool states
  if (scorecard.peak_score_active) {
    activeTriggers.add('peak_score_active');
    triggerLabels['peak_score_active'] = 'Peak-score ceiling active';
  }
  if (scorecard.conflict_flag) {
    activeTriggers.add('conflict_flag:active');
    triggerLabels['conflict_flag:active'] = 'CONFLICT flag active';
  }
  if (scorecard.composition_flag) {
    activeTriggers.add('composition_flag:active');
    triggerLabels['composition_flag:active'] = `Composition flag: ${scorecard.composition_flag}`;
  }

  // External composite state
  if (scorecard.external_composite <= -3) {
    activeTriggers.add('external:negative_deep');
    triggerLabels['external:negative_deep'] = 'External composite deep negative';
  }
  if (scorecard.external_composite < 0) {
    activeTriggers.add('external:negative');
    triggerLabels['external:negative'] = 'External composite negative';
  }
  if (
    scorecard.external_composite >= 0 &&
    scorecard.external_composite <= 2 &&
    scorecard.band !== 'Strong Bearish' &&
    scorecard.band !== 'Bearish'
  ) {
    activeTriggers.add('external:decaying');
    triggerLabels['external:decaying'] =
      'External composite below Domestic (possible divergence)';
  }

  // Domestic floor
  if (scorecard.domestic_composite >= 5) {
    activeTriggers.add('domestic:floor_holding');
    triggerLabels['domestic:floor_holding'] = `Domestic floor holding (+${scorecard.domestic_composite})`;
  }

  // Velocity-based — fire only when velocity is known.
  if (velKnown) {
    const vel = velocityShortValue;
    if (vel <= -0.15 && (scorecard.band === 'Strong Bullish' || scorecard.band === 'Bullish')) {
      activeTriggers.add('velocity:decay');
      triggerLabels['velocity:decay'] = `Velocity decaying in bullish band (${vel.toFixed(2)}/day)`;
    }
    if (vel <= -0.5) {
      activeTriggers.add('velocity:high');
      triggerLabels['velocity:high'] = `High deterioration velocity (${vel.toFixed(2)}/day)`;
    }
    if (vel >= 0.75) {
      activeTriggers.add('velocity:ceiling_recovery');
      triggerLabels['velocity:ceiling_recovery'] = `Ceiling recovery velocity (${vel.toFixed(2)}/day)`;
    }
    if (Math.abs(vel) < 0.1) {
      activeTriggers.add('velocity:flat');
      triggerLabels['velocity:flat'] = 'Velocity flat';
    }
    if (vel >= 0.1 && vel < 0.75) {
      activeTriggers.add('velocity:positive');
      triggerLabels['velocity:positive'] = `Positive recovery velocity (${vel.toFixed(2)}/day)`;
    }
  }

  // Regime bucket (optional on PublicScorecard — skip when undefined)
  if (scorecard.bucket) {
    activeTriggers.add(`bucket:${scorecard.bucket}`);
    triggerLabels[`bucket:${scorecard.bucket}`] = `Regime: ${scorecard.bucket}`;
  }

  // Ind 9 raw states (nullable on PublicScorecard)
  if (scorecard.ind9_raw_composite !== null) {
    const raw = scorecard.ind9_raw_composite;
    if (Math.abs(raw) >= 7) {
      activeTriggers.add('ind9_raw:large_swing');
      triggerLabels['ind9_raw:large_swing'] = `Ind 9 raw at extreme (${raw})`;
    }
    if (Math.abs(raw) >= 1 && Math.abs(raw) <= 4) {
      activeTriggers.add('ind9_raw:near_threshold');
      triggerLabels['ind9_raw:near_threshold'] = `Ind 9 raw near threshold (${raw})`;
    }
  }

  // Always-relevant marker
  activeTriggers.add('always_relevant');
  triggerLabels['always_relevant'] = 'Always contextually relevant';

  // External turning (positive external with low net in recovery)
  if (scorecard.external_composite >= 0 && scorecard.net_score >= 4 && scorecard.net_score <= 8) {
    activeTriggers.add('external:turning');
    triggerLabels['external:turning'] = 'External composite recovering';
  }

  // Post-V-bottom context — uses fetched history rather than module-level data
  if (scorecard.band === 'Bullish' || scorecard.band === 'Neutral') {
    const recentBearish = history.some(
      (s) => s.band === 'Bearish' || s.band === 'Strong Bearish',
    );
    if (recentBearish) {
      activeTriggers.add('phase:post_v_bottom');
      triggerLabels['phase:post_v_bottom'] = 'Post-bear-phase recovery';
    }
  }

  // Caution band
  if (scorecard.band === 'Caution') {
    activeTriggers.add('band:Caution');
  }

  const results: PatternRelevance[] = patterns.map((pattern) => {
    const matchedTriggerKeys: string[] = [];
    for (const trigger of pattern.relevance_triggers) {
      if (activeTriggers.has(trigger)) {
        matchedTriggerKeys.push(trigger);
      }
    }

    let score = 0;
    if (pattern.tier === 'CONFIRMED') score += 10;
    else if (pattern.tier === 'OBSERVED') score += 5;

    if (matchedTriggerKeys.includes('always_relevant')) {
      score = 100;
    } else {
      const matchCount = matchedTriggerKeys.length;
      if (matchCount >= 3) score += 75;
      else if (matchCount === 2) score += 50;
      else if (matchCount === 1) score += 25;
    }

    const matched_triggers = matchedTriggerKeys
      .filter((k) => k !== 'always_relevant')
      .map((k) => triggerLabels[k] ?? k);

    return { pattern, relevance_score: score, matched_triggers };
  });

  return results.sort((a, b) => b.relevance_score - a.relevance_score);
}
