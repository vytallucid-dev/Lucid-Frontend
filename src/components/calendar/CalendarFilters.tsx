"use client";

/**
 * Currency and impact toggles.
 *
 * Both option lists are DERIVED from the events actually returned — never a
 * hardcoded currency or impact list. A week with no AUD release shows no AUD
 * chip, and a new currency entering the indicator universe appears here with
 * no code change. Empty selection means "all", so the resting state needs no
 * select-all affordance.
 */

/** Impact ordering is semantic, not alphabetical — High reads first. */
const IMPACT_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export function deriveCurrencies(events: { country: string }[]): string[] {
  return Array.from(new Set(events.map((e) => e.country))).sort();
}

export function deriveImpacts(events: { impact: string }[]): string[] {
  return Array.from(new Set(events.map((e) => e.impact))).sort(
    (a, b) => (IMPACT_RANK[a] ?? 99) - (IMPACT_RANK[b] ?? 99) || a.localeCompare(b),
  );
}

function Chip({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`lx-cal-chip ${on ? "is-on" : ""}`}
      aria-pressed={on}
      onClick={onToggle}
    >
      {label}
    </button>
  );
}

export function CalendarFilters({
  currencies,
  impacts,
  selectedCurrencies,
  selectedImpacts,
  onToggleCurrency,
  onToggleImpact,
}: {
  currencies: string[];
  impacts: string[];
  selectedCurrencies: Set<string>;
  selectedImpacts: Set<string>;
  onToggleCurrency: (c: string) => void;
  onToggleImpact: (i: string) => void;
}) {
  if (currencies.length === 0 && impacts.length === 0) return null;

  return (
    <div className="lx-cal-filters" role="group" aria-label="Filter releases">
      <div className="lx-cal-filter-group">
        <span className="lx-eyebrow" aria-hidden="true">
          Ccy
        </span>
        {currencies.map((c) => (
          <Chip
            key={c}
            label={c}
            on={selectedCurrencies.has(c)}
            onToggle={() => onToggleCurrency(c)}
          />
        ))}
      </div>

      {currencies.length > 0 && impacts.length > 0 && (
        <span className="lx-cal-filter-sep" aria-hidden="true" />
      )}

      <div className="lx-cal-filter-group">
        <span className="lx-eyebrow" aria-hidden="true">
          Impact
        </span>
        {impacts.map((i) => (
          <Chip
            key={i}
            label={i}
            on={selectedImpacts.has(i)}
            onToggle={() => onToggleImpact(i)}
          />
        ))}
      </div>
    </div>
  );
}
