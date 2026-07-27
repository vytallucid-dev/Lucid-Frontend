# Lucid Frontend — UI Reconnaissance v1

**Read-only recon.** No source file was modified to produce this document. Codebase: `Lucid-Frontend` (Next.js 16.2.1 App Router, React 19.2.4, TypeScript ^5, Tailwind CSS v4, TanStack React Query ^5.100.11). Stack: `package.json` at project root.

> **Jargon note:** "Client-side" / "frontend-computed" means the number is calculated by the user's browser after the raw data arrives, rather than being calculated once on the server and shipped ready-made. This matters because two different screens computing the "same" number independently can quietly drift apart if their formulas aren't kept in sync by hand.

---

## Summary page

| Metric | Count |
|---|---|
| Total pages (routes with a `page.tsx`) | 34 |
| Total sub-tab groups (layout-level tab strips) | 3 (NIFTY, Oracle, Trading) + 1 in-page tab widget (System: Models/Pairs/Sessions) |
| Total distinct visual sections catalogued (Section 3) | ~230 (counted across all pages/sub-tabs; see Section 3 tables) |
| Total drawers/modals/overlays catalogued (Section 4) | 15 distinct implementations (2 generic shells reused 12+ times, plus 5 form modals, 4 fullscreen analysis overlays, toast system, confirm dialog) |
| Shared components (imported by 2+ pages) | 17 (Section 5) |
| Hardcoded color values in `.ts`/`.tsx` files | **392** (231 hex + 161 rgb/rgba/hsl/hsla) across ~50 files (Section 7) |

**The answer to Section 2's final question, stated plainly:** For the three main tabbed sections (NIFTY, Oracle, Trading), yes — the active sub-tab lives entirely in the URL, so any component elsewhere in the app (Sidebar, TopBar, or a future global layout piece) can read it just by asking Next.js "what's the current URL path," which every component is already allowed to do. But for the Trading → System page's Models/Pairs/Sessions switcher, and roughly ten other in-page view/filter toggles (Journal's table/gallery view, Oracle scorecard's asset picker, etc.), the answer is no — those live in a plain in-memory variable owned by that one page, invisible to everything else, and forgotten the moment you navigate away or refresh.

**Three highest-severity Risk Register items:**
1. **HIGH** — `src/components/oracle-tools/chartTheme.ts` is folder-named as Oracle-only but is silently imported and relied on by three NIFTY chart components (`FlowTrackerChart.tsx`, `FlowTrackerMiniChart.tsx`, `HistoryChart.tsx`). A theming change made "just for Oracle" will reskin NIFTY charts without anyone touching a NIFTY file.
2. **HIGH** — The entire Trading Hub (Journal, Accounts, Analytics, Dashboard, System) computes every statistic — win rate, expectancy, drawdown, equity curves — in the browser, and does so with **four separate, independently-written copies** of similar math (`src/lib/stats.ts`, `trading/analytics/page.tsx`, `AccountDrawerContent.tsx`, `dashboard/page.tsx`). These can drift from each other silently; there is no backend-computed number to check them against.
3. **HIGH** — No drawer or dialog in the app (the shared `DetailDrawer`, `ConfirmDialog`, or any of the fullscreen analysis overlays) traps keyboard focus or restores it on close. A keyboard-only user can Tab out of an open drawer into the page behind it.

**Count of every `UNKNOWN` in this document:** 9 (see inline `UNKNOWN —` markers throughout, and the consolidated list in Section 13.5).

---

## 1 · Route and navigation inventory

### 1.1 How the main navigation menu is built

The sidebar's menu items are a plain, hand-written list in the code — not generated from the list of pages that exist. Source: `src/components/Sidebar.tsx:9-16` (the `navItems` array):

| Label (exact) | Sub-label (exact) | Links to |
|---|---|---|
| "Dashboard" | "Overview" | `/dashboard` |
| "Trading Hub" | "Journal & Accounts" | `/trading/journal` |
| "NIFTY" | "Fundamental Bias" | `/nifty/pulse` |
| "Scanner" | "Oracle" | `/oracle` |
| "Lucid" | "AI Chat" | `/lucid` |
| "Settings" | *(none — sub-label intentionally blank)* | `/settings` |

One more item is added to this list, but only for admin accounts (`Sidebar.tsx:30-35`):

| Label (exact) | Sub-label (exact) | Links to | Visible to |
|---|---|---|---|
| "Data" | "Admin Pipelines" | `/data` | Only accounts where `isAdmin` is true |

### 1.2 Every route found in the code

| URL | File that renders it | Nav label | Reachable, and from where | Notes |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` → `src/app/landing/page-content.tsx` | — | Yes, the root address itself; shown with no sidebar/topbar | Marketing/landing page |
| `/dashboard` | `src/app/dashboard/page.tsx` | "Dashboard" | Yes — sidebar | |
| `/trading` | `src/app/trading/page.tsx` | — | Yes, but instantly forwards the visitor to `/trading/journal` and shows nothing itself | Pure redirect, no screen |
| `/trading/journal` | `src/app/trading/journal/page.tsx` | "Journal" (sub-tab) | Yes — sidebar "Trading Hub" goes straight here; also a sub-tab | |
| `/trading/journal/[id]` | `src/app/trading/journal/[id]/page.tsx` | — | Yes, by clicking any trade row | Full-page version of the trade drawer |
| `/trading/planned` | `src/app/trading/planned/page.tsx` | "Planned Trades" (sub-tab) | Yes — sub-tab | |
| `/trading/planned/[id]` | `src/app/trading/planned/[id]/page.tsx` | — | Yes, by clicking a planned-trade row | |
| `/trading/accounts` | `src/app/trading/accounts/page.tsx` | "Accounts" (sub-tab) | Yes — sub-tab | |
| `/trading/accounts/[id]` | `src/app/trading/accounts/[id]/page.tsx` | — | Yes, by clicking an account row | |
| `/trading/system` | `src/app/trading/system/page.tsx` | "System" (sub-tab) | Yes — sub-tab | Has its own internal Models/Pairs/Sessions switcher (Section 2) |
| `/trading/analytics` | `src/app/trading/analytics/page.tsx` | "Analytics" (sub-tab) | Yes — sub-tab | |
| `/nifty` | `src/app/nifty/page.tsx` | — | Yes, but instantly forwards to `/nifty/pulse` | Pure redirect |
| `/nifty/pulse` | `src/app/nifty/pulse/page.tsx` | "Pulse" (sub-tab) | Yes — sidebar "NIFTY" goes straight here; also a sub-tab | |
| `/nifty/scorecard` | `src/app/nifty/scorecard/page.tsx` | "Scorecard" (sub-tab) | Yes — sub-tab | |
| `/nifty/history` | `src/app/nifty/history/page.tsx` | "History" (sub-tab) | Yes — sub-tab | |
| `/nifty/patterns` | `src/app/nifty/patterns/page.tsx` | "Patterns" (sub-tab) | Yes — sub-tab | |
| `/nifty/usd-lab` | `src/app/nifty/usd-lab/page.tsx` | — | **Yes, but only via buttons buried inside Pulse/Scorecard pages — no permanent tab or menu entry points here** | See flag below |
| `/nifty/v-bottom` | `src/app/nifty/v-bottom/page.tsx` | — | **Yes, but only via a conditional banner button on Pulse (shown only when the mood reading is "Bearish"/"Strong Bearish")** | See flag below |
| `/nifty/velocity` | `src/app/nifty/velocity/page.tsx` | — | **Yes, but only via buttons buried inside Pulse — no permanent tab or menu entry point** | See flag below |
| `/oracle` | `src/app/oracle/page.tsx` | "Top Setups" (sub-tab) | Yes — sidebar "Scanner" goes straight here; also a sub-tab | |
| `/oracle/scorecard` | `src/app/oracle/scorecard/page.tsx` | "Asset Scorecard" (sub-tab) | Yes — sub-tab | |
| `/oracle/fx-scorecard` | `src/app/oracle/fx-scorecard/page.tsx` | "FX Scorecard" (sub-tab) | Yes — sub-tab | |
| `/oracle/heatmap` | `src/app/oracle/heatmap/page.tsx` | "Heatmap" (sub-tab) | Yes — sub-tab | |
| `/oracle/cot` | `src/app/oracle/cot/page.tsx` | "COT Report" (sub-tab) | Yes — sub-tab | |
| `/oracle/compass` | `src/app/oracle/compass/page.tsx` | "Compass" (sub-tab) | Yes — sub-tab | |
| `/data` | `src/app/data/page.tsx` | "Data" (sidebar, admin-only) | Yes, but hidden from ordinary users both in the menu and by an in-page "Admin access required" block | |
| `/data/nifty` | `src/app/data/nifty/page.tsx` | — | Yes, by clicking the NIFTY tile on `/data` | Admin-gated |
| `/data/nifty/[code]` | `src/app/data/nifty/[code]/page.tsx` | — | Yes, by clicking an indicator card | Admin-gated |
| `/data/edgefinder` | `src/app/data/edgefinder/page.tsx` | — | Yes, by clicking the EdgeFinder tile on `/data` | Admin-gated |
| `/data/edgefinder/[code]` | `src/app/data/edgefinder/[code]/page.tsx` | — | Yes, by clicking an indicator card | Admin-gated |
| `/settings` | `src/app/settings/page.tsx` | "Settings" | Yes — sidebar; also the user-menu "Settings" link in the top bar | Page body is a static placeholder — see flag below |
| `/lucid` | `src/app/lucid/page.tsx` | "Lucid" | Yes — sidebar | Page body is a static "coming soon" mock-up — see flag below |
| `/ledger` | `src/app/ledger/page.tsx` | — | **No — not in the sidebar or any other menu found anywhere in the code. Only reachable by someone typing the address directly.** | **Orphaned route** — see flag below |
| `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/check-email` | `src/app/auth/*/page.tsx` | Varies | Yes — the normal sign-in flow, cross-linked to each other | Own layout, no sidebar/topbar |
| `/auth/callback` | `src/app/auth/callback/route.ts` | — (not a page) | Server-side handler for email/OAuth confirmation links | Not a visible screen |

### 1.3 Things flagged as unfinished, hidden, or orphaned

- **`/ledger` is a true orphan.** The page exists, works, and even has an entry in the top bar's internal label-lookup table, but there is no link, button, or menu item anywhere in the reviewed code that leads a user to it. The only way in is typing the URL by hand.
- **`/settings` and `/lucid` are reachable but unfinished.** Both show a static "coming soon" placeholder instead of real functionality — this is an intentional preview, not a bug, but worth knowing before any redesign work touches them.
- **`/data` and everything under it is intentionally hidden from regular users** (an internal admin tool for managing the data pipelines that feed NIFTY/Oracle), gated both in the menu and again inside each page.
- **`/trading` and `/nifty` have no screen of their own** — they exist purely to bounce the visitor to a real sub-page.
- **`/nifty/usd-lab`, `/nifty/v-bottom`, and `/nifty/velocity` are fully-built, real pages with no permanent way back to them** — no tab, no menu item, nothing in the persistent chrome. The only paths in are contextual buttons buried inside the Pulse and Scorecard pages. This looks like a deliberate "diagnostic tool, not a primary destination" design choice, but it does mean a visitor who lands on one of these three pages and then, say, refreshes or uses the browser's forward button has no persistent UI element pointing back to it.
- **A few UI blocks are explicitly labeled as future work directly in the interface** — e.g., Oracle's "Lucid Outlook" panels say "⚡ Coming in Phase 4"; Oracle's "This-Week Calendar" panel says outright that the data isn't available yet and explains why.

---

## 2 · Sub-tab mechanism — how it works today

This is the single most important section for judging how hard a redesign will be, so it's covered in full here rather than summarized.

### The app actually has three different sub-tab systems, not one

**System A — the three main tab strips (NIFTY, Oracle, Trading Hub).** Each of these three sections has its own row of tabs at the top of the page (e.g., NIFTY's Pulse / Scorecard / History / Patterns). All three work identically, even though each was coded separately:

- **Where the tab list lives:** A plain array written directly in that section's shell file — `src/app/nifty/layout.tsx:8-13`, `src/app/oracle/layout.tsx:8-15`, `src/app/trading/layout.tsx:6-12`. Not a shared config file, not generated from anything — three near-identical hand-written lists.
- **Where "which tab is currently open" lives:** **The web address itself.** Each tab is a real link to a real page (e.g., clicking "Scorecard" takes you to `/nifty/scorecard`). The tab strip figures out which one to highlight simply by comparing the current address to each tab's link — there is no separate memory of "which tab is active."
- **What draws the tab strip:** Three separate, independently-coded components (one per section) that happen to look almost identical, not one shared "tab bar" component.
- **What happens on click:** A normal page navigation. The browser's address bar changes, the page underneath swaps out completely, and that new page fetches its own data fresh (subject to normal caching, so a quick revisit within about a minute may not show a loading spinner).
- **Survives a refresh?** **Yes** — because the "active tab" is just the web address, reloading the page naturally keeps you on the same tab.
- **Survives leaving and coming back?** **Yes**, for the same reason, and the browser's Back/Forward buttons work normally too.
- **Can something outside the page — like the sidebar or the top bar — tell which tab is open?** **Yes.** Both the sidebar and the top bar independently check "what's the current web address" (a standard, always-available browser/framework feature), which is exactly how the sidebar already highlights "Trading Hub" no matter which Trading sub-tab you're actually on.

### System B — the Trading Hub's "System" page has its own internal switcher (Models / Pairs / Sessions)

This is a **different and much more limited mechanism**, found only at `/trading/system`:

- **Where the tab list lives:** A short hardcoded list inside that one page's file (`src/app/trading/system/page.tsx:944`).
- **Where "which tab is open" lives:** A private piece of in-memory page state (`useState`) that exists only while you're looking at that exact page. It is **not** reflected in the web address, not stored anywhere, and invisible to every other part of the app.
- **What draws the tab strip:** Coded directly inside that one page, not shared with anything else.
- **What happens on click:** No page navigation at all — it just swaps which block of content is shown, instantly, without fetching anything new from the server (the underlying data was likely already loaded).
- **Survives a refresh? No.** Reloading the page always snaps back to "Models," no matter which tab you had open.
- **Survives leaving and coming back? No.** Navigate away and return, and it's back to "Models" again — nothing remembers your last choice.
- **Can anything outside the page see which one is active? No.** There is no mechanism — no shared memory, no web address, nothing — by which the sidebar, top bar, or any other component could know whether you're looking at Models, Pairs, or Sessions.

**The same "invisible, forgetful" pattern (System B) also shows up in about ten smaller, less obvious places that function like tabs even though they aren't officially called that** — for example: the History page's "By Phase" vs "By Date" view switch, the Oracle Scorecard and FX Scorecard's asset-picker row, the Oracle Heatmap's country picker, the Journal and Accounts pages' Table/Gallery view toggle, and the Planned Trades status filter chips. All of these behave exactly like the System page's switcher: private to that one page, forgotten on refresh or on leaving and returning.

### A third, simpler case — the "Data" admin section has no tabs at all

The admin Data pages don't use a tab strip; they use plain breadcrumb-style links (e.g., "Data > NIFTY") written directly into each page. There's no "active tab" concept to speak of there.

### Why this matters for a redesign

If a future redesign wants a persistent piece of chrome (say, a global header) to always know "which sub-tab is the user looking at right now," that's **already possible today, for free, for the three main sections** (NIFTY/Oracle/Trading) because the answer lives in the web address. But it is **not possible today** for the System page's Models/Pairs/Sessions switcher, or for any of the ~10 other in-page toggles listed above, because their answer lives only inside that one page's private memory. Making those visible from outside would require an actual code change (e.g., moving that piece of state into the web address or into some shared, page-independent memory) — it isn't a simple wiring exercise, it's new plumbing.

---

## 3 · Page and section inventory

Every page below is broken into its visual sections, in on-screen order. "Computed in the frontend" is flagged wherever a number shown to the user is calculated by the browser rather than delivered ready-made by the server — see Section 8 for why that matters.

### Dashboard (`/dashboard`)

| Section | File | Purpose | Data shown | Source | Interactions | States handled | Notes |
|---|---|---|---|---|---|---|---|
| Hero / greeting + chat bar | `dashboard/page.tsx:757-795` | Personal welcome + one-line status | Time-of-day greeting, user's first name, status line, a chat input | Greeting/status **computed in frontend** from loaded accounts/trades | Typing + submitting the chat box just shows a "Coming in Phase 3" notice — **not a working feature yet** | No loading/error state (always shows once other data is in) | |
| Quick Actions | `:797-846` | One-click shortcuts | 4 tiles: "Log Trade", "Cash Flow", "View Planned", "Open Scanner" | Static | Opens the Add Trade modal / Cash Flow modal / navigates | — | |
| Overview (metric cards) | `:858-952` | At-a-glance account health | Total Balance, Overall P&L, Active Accounts, Rolling Win Rate, and a 5th adaptive card (Challenges Active or Best Performing Account) | **All computed in frontend** from the raw list of accounts/trades | Numbers flash gold/red on change | Loading (staged messages), error (with retry); no distinct empty state (shows $0/0%) | |
| Performance (P&L curve) | `:954-1029` | Cumulative profit/loss over time | Chart of running P&L with shaded drawdown periods; 30d/90d/All-time toggle | **Computed in frontend** by summing trades chronologically | Toggle time range; hover for detail | Empty chart if no trades (no explicit message) | |
| Live Trades | `:1035-1107` | What's open right now | Pair, direction, entry price, "Live" pulse, conviction | Trades currently missing a close date | Click row opens a detail drawer | Empty: "No live trades running." | New rows flash gold |
| Planned Trades | `:1112-1179` | Setups being watched | Pair, direction, planned entry, distance-to-trigger, status | Distance **computed in frontend** | Click row opens detail drawer | Empty: "No setups planned." | |
| Accounts snapshot | `:1182-1210` | Quick per-account view | Type, name, status, balance, P&L%, progress bars | Progress bars **computed in frontend** | Click row opens detail drawer; "View all" link | Empty: "No accounts yet. Add one to get started." | |
| Fundamental Bias (FX/Gold) + NIFTY macro pulse | `:1213-1285` | Macro backdrop for tracked pairs, India macro snapshot | NIFTY band + composite scores + sparkline; per-pair bias tiles | Fetched from the NIFTY/Oracle backend — **a genuine cross-feature integration**, not part of the trading data itself | Click a tile routes to the matching Oracle page | Separate loading text for the NIFTY sub-card | The "Live" pulse label here is purely decorative, not tied to real freshness |

*(Add Trade modal, Planned/Trade/Account detail drawers, and the Cash Flow modal mounted on this page are documented once in Section 4 rather than repeated here.)*

### Trading Hub shell (`/trading/*`)

`/trading` itself has no screen — it immediately forwards to `/trading/journal`. The shell (`trading/layout.tsx`) draws the Journal / Planned Trades / Accounts / System / Analytics tab strip described in Section 2.

#### Journal (`/trading/journal`)

| Section | File | Purpose | Data shown | Source | Interactions | States |
|---|---|---|---|---|---|---|
| Page header | `journal/page.tsx:194-213` | Title + running totals | "Journal" title, trade count, net $ | **Computed in frontend** from the currently filtered list | Numbers animate on change | — |
| Controls bar | `:216-288` | Add/filter/view | "Add Trade" button, account picker, filter chips (Pair/Model/Direction/Outcome/Session/Conviction), Table/Gallery toggle | Account/pair/model lists from the trading API | Opens Add Trade modal; adds/removes filter chips; toggles view | — |
| Trade list (Table or Gallery) | `:290-307`, `JournalTable.tsx`, `JournalGallery.tsx` | The actual trade log | Table: Date, Pair, Model, Dir, Entry, Exit, Pips, Risk, R:R, P&L, Exit Type, Conviction. Gallery: same info as cards with a chart-screenshot preview. | Filtered/sorted **in the frontend** | Row/card click opens the trade detail drawer | Loading (staged), error (retry), and two different empty states depending on whether a filter is active |

**Flag:** both `JournalTable` and `JournalGallery` look up each pair's flag/display name from a small built-in reference list rather than the live, user-editable pairs list — a pair a user adds themselves in System → Pairs may show with no flag here even though it works fine in the Add Trade form.

#### Planned Trades (`/trading/planned`)

| Section | File | Purpose | Data shown | Source | Interactions | States |
|---|---|---|---|---|---|---|
| Page header | `planned/page.tsx:450-465` | Title + counts | "Planned Trades" title, active count, invalidated count | **Computed in frontend** | — | — |
| Top bar | `:468-509` | Filter + create | Status filter chips (All/Watching/Ready/Invalidated/Cancelled), "Add Planned Trade" button | Static list | Filters the list; opens Add modal | — |
| Status-grouped tables | `:258-376` | Group setups by lifecycle stage | Per group: Pair, Model, Dir, Entry, Current, Distance, R:R, Risk, Conviction, Actions | Grouping and R:R/Distance **computed in frontend** | Row click opens drawer; "Convert →" opens Add Trade pre-filled; "⋯" menu for Edit/Invalidate/Cancel/Delete; sections collapse/expand | Loading, error, and a custom empty state distinct from per-section "no X setups" messages |

#### Accounts (`/trading/accounts`)

| Section | File | Purpose | Data shown | Source | Interactions | States |
|---|---|---|---|---|---|---|
| Page header | `accounts/page.tsx:620-630` | Title + totals | "Accounts" title, Total Balance, Net P&L | **Computed in frontend** | — | — |
| Top bar | `:633-660` | Add/log/view | "Add Account", "Cash Flow" buttons, Table/Gallery toggle | — | Opens modals; toggles view | — |
| Table view | `:668-723` | Scannable account list | Name, Type, Broker, Balance, Net P&L%, Win Rate, Stage, Target bar, Drawdown bar, Status | Per-row stats **computed in frontend** | Row click opens detail drawer | Loading, error, empty ("No accounts yet") |
| Gallery view | `:70-200` | Card-style overview | Same fields as cards, branching layout for prop-firm vs. personal accounts | Same computed helpers | Card click opens drawer | Same empty state |

#### System (`/trading/system`) — has its own internal Models / Pairs / Sessions switch (see Section 2)

| Tab | Sections | Data | Notes |
|---|---|---|---|
| Models | "Add Model" button, model cards (name, status, description, performance stats), detail drawer with linked trades | Performance **computed in frontend** per model | Add/Edit modal, delete confirmation |
| Pairs | "Add Pair" button, pair cards (flags, name, status, performance, recent trades), detail drawer | Performance **computed in frontend** per pair | Add/Edit modal, delete confirmation |
| Sessions | Read-only session cards (Asian/London/Overlap/New York): trade count, win rate, avg P&L, best pair, % of total | Fully **computed in frontend**, re-computed independently inside every card component | No create/edit — auto-tagged from trade time |

#### Analytics (`/trading/analytics`)

Every number on this page is computed in the browser — there is no dedicated analytics endpoint on the backend at all.

| Section | Purpose | Data | Notes |
|---|---|---|---|
| Filter bar | Scope the page | Date range, account picker | |
| Headline stats (8 tiles) | Top-line performance | Expectancy/Trade, Net P&L, Win Rate, Avg Winner, Avg Loser, Avg R:R, Total Trades, W/L/BE | All **computed in frontend** |
| Equity Curve | Cumulative P&L with drawdown shading and a Max Drawdown badge | | **Computed in frontend** |
| Breakdown Tables (By Pair / Model / Conviction Tier / Session / Hold Time) | Find where the edge (or the drag) is | Sortable # Trades, Win Rate, Net P&L, Expectancy, Avg R:R per group | **Computed in frontend**; "Conviction Tier" is actually a risk-size proxy, not the trade's own conviction tag — a subtle mislabeling worth knowing about |
| Rule Violations panel | Separate "broke my rules" losses from clean losses | Count + net P&L for each bucket | Reads a `mistakes` field that **does not exist anywhere in the actual trade data model** — this section is permanently in its empty state today; there is no UI anywhere that lets a user actually tag a trade this way |

#### Ledger (`/ledger`) and Lucid (`/lucid`)

Both are entirely static placeholder screens today — "In Development" / "Phase 3, coming soon" — with no real data, no interactions beyond decorative ones, and (because there's nothing to load) no loading/error/empty states to speak of. Lucid's chat input box, notably, has no working handlers at all — it's a picture of a chat box, not a functioning one.

### NIFTY (`/nifty/*`)

Shell: `nifty/layout.tsx` draws the Pulse / Scorecard / History / Patterns tab strip plus a "Tools" button that opens the NIFTY Tools drawer (Section 4).

#### Pulse (`/nifty/pulse`) — the default landing tab

| Section | Purpose | Data | Source | Notes |
|---|---|---|---|---|
| Page header | Title + as-of date | Date, missing-indicator count, phase/bucket | Latest scorecard | |
| Hero Band Card | Headline mood reading | Band name, Net score, 13-indicator context, 10-point sparkline, velocity, peak info | Latest scorecard + short history | |
| Conditional banners | Surface important context | "Ceiling State" (ranking is maxed out), "CONFLICT" (domestic vs. external disagree), "V-Bottom diagnostic available" (only when band is bearish) | Latest scorecard flags | Each only shows under its specific condition |
| Composite Breakdown | 3-up Domestic/External/Net cards | Values + progress bars | Latest scorecard | Clicking Domestic/External opens a drawer; clicking Net goes to the Scorecard tab |
| "What Changed" / "Ind 9 Composition" strip | Explain the day's move | Catalyst bullets, per-indicator flips, cluster breakdown | Mix of raw fields and **frontend-computed** sums | |
| Phase Narrative | Editorial context | Free-text notes | Latest scorecard | Hidden entirely if there are no notes |

#### Scorecard (`/nifty/scorecard`)

Date picker + summary strip + a 13-indicator grid (grouped Domestic/External/Futures) + a compact centered bar chart, all driving a shared detail drawer with a scoring-rule reference, a dated history table, and a "Related Patterns" list.

**Flag:** the "Related Patterns" list inside this drawer matches against an old, hand-maintained mock list of patterns rather than the same live pattern data the dedicated Patterns tab uses — the two could show different things for what looks like the same feature.

#### History (`/nifty/history`)

A full-history line chart with pattern markers, a By-Phase / By-Date view toggle, search, and band/sub-tool filters, all driving a shared scorecard-detail drawer. The chart honestly labels itself: it tells the user, in the UI copy itself, that some pattern markers are calculated live and others are only shown on a fixed list of known historical dates.

#### Patterns (`/nifty/patterns`)

A "Relevant Now" shortlist (entirely computed in the frontend by scoring every pattern against today's reading) plus a full filterable library of pattern cards, driving a detail drawer.

**Bug flag:** inside that detail drawer, the "Instance Examples" rows show an "Open scorecard →" link that looks clickable but has no click handler wired up at all — clicking does nothing. The very similar feature on the V-Bottom page does this correctly with a real link.

#### V-Bottom (`/nifty/v-bottom`) and Velocity (`/nifty/velocity`)

Both are single-purpose diagnostic pages reached only via buried buttons (Section 1.3), each with a date picker, a big verdict/value card, a historical-instances list, and (V-Bottom only) a static reference table of the classification thresholds. Velocity's "Historical Events" panel is a permanent placeholder — the text explains outright that the backend doesn't have this data yet, so it isn't really an "empty state," it's an unbuilt feature.

#### USD Lab (`/nifty/usd-lab`)

The most data-dense NIFTY page: a hero strip (score / raw composite slider / composition flag), a "how this number is computed" teaching section, a full 14-row sub-indicator table with filter chips, four cluster cards, a composition-flag explainer, a historical chart, and a data-quality panel — all driving a detail drawer with its own scoring-rule reference and a "what if I removed this one sub-indicator" calculation done live in the browser.

### Oracle (`/oracle/*`)

Shell: `oracle/layout.tsx` draws the Top Setups / Asset Scorecard / FX Scorecard / Heatmap / COT Report / Compass tab strip plus a "Tools" button (Section 4).

#### Top Setups (`/oracle`)

A "biggest movers" strip, a regime summary line linking to Compass, a bias filter + sort + search bar, four summary tiles, and a large table (14 individual indicator columns grouped under Economic Growth / Inflation / Jobs Market headers) with a click-to-open quick-detail side panel.

#### Asset Scorecard / FX Scorecard (`/oracle/scorecard`, `/oracle/fx-scorecard`)

An asset/pair picker, a score gauge with bias, a 12-week score history mini-chart, a score breakdown (COT/Fundamentals/Total), a COT detail card, and a right-hand column of full indicator tables grouped by category, plus a "Lucid Outlook" panel explicitly marked as a future feature.

**Flag:** the 12-week score history chart's date labels come from a fixed, hardcoded 12-week calendar (literally "Jan 5, Jan 12, …") rather than the real dates of whatever data actually loaded — if the loaded week doesn't happen to be that exact calendar window, the labels underneath the chart could show the wrong dates.

#### Heatmap (`/oracle/heatmap`)

An economy picker (US/EU/UK/Japan), summary tiles, a grouped indicator-release table, and an overall bias bar. Clicking a row is supposed to open a deeper "Indicator Trend" view, but that depends on guessing the indicator's internal code from its display name using pattern-matching — rows whose name doesn't match the guessing rules silently aren't clickable, with only a subtle cursor-style difference to hint at it.

#### COT Report (`/oracle/cot`)

A horizontal long%/short% positioning bar chart per asset, and a full sortable data table with an extra 4-week trend sparkline column.

#### Compass (`/oracle/compass`)

The most elaborate Oracle page: a shock-alert banner, a regime "hero" card explaining the current market posture, a 6-input vote breakdown, a "here's the math" classification-logic table, two override-gate status cards, a scoring-overrides panel, a per-asset score-impact table, and a scrollable audit-log history table.

### Settings (`/settings`)

A single static "In Development" placeholder — no data, no interactions.

### Data (admin-only) (`/data`, `/data/nifty*`, `/data/edgefinder*`)

Every page under `/data` is blocked behind an `isAdmin` check and shows "Admin access required" if the visitor isn't an admin. For admins, this is a genuine internal tool: module summary cards, per-indicator cards showing freshness (Fresh/Stale/Critical/Never), and detailed per-indicator pages with editable forms for manually entering data or triggering backend data-fetch jobs, plus live-polling job-status panels and recent-fetch-log tables.

**Flag:** the summary tiles on the `/data` landing page fall back to hardcoded numbers (e.g. "13" indicators) whenever the real count is loading or happens to be zero — meaning a genuine backend problem that returns zero indicators could be silently masked by a hardcoded fallback number that looks fine.

---

## 4 · Drawer, modal, and overlay inventory

| Overlay | File | Opened from | Read-only or editable | Where "open/closed" lives | Shared or one-off | How it closes |
|---|---|---|---|---|---|---|
| **DetailDrawer** (generic slide-in panel) | `src/components/DetailDrawer.tsx` | 12+ places across Trading, NIFTY, Oracle, plus both "Tools" drawers | The shell is read-only chrome; content varies by caller | A simple "is something selected" variable, owned separately by each page | **Shared shell**, used everywhere | Escape key, clicking the backdrop, or the × button |
| **ConfirmDialog** (delete confirmation) | `src/components/ConfirmDialog.tsx` | Every delete action across Trading (trades, planned trades, accounts, models, pairs) | Yes/no confirmation only, no fields | Owned by the calling page | Shared | Escape/backdrop/Cancel — all disabled while the delete is in progress |
| **AddTradeModal** | `src/app/trading/journal/AddTradeModal.tsx` | Journal, Dashboard, trade detail page, and Planned→Live conversion | **Editable form** (create or edit) | Owned by the calling page | Reused across 4 places | Backdrop click or × — **no confirmation if you have unsaved typing, it's just silently discarded** |
| **AddPlannedTradeModal** | `src/app/trading/planned/AddPlannedTradeModal.tsx` | Planned Trades list and detail page | Editable form | Owned by the calling page | Reused | Same silent-discard behavior as above |
| **Account / Cash Flow modals** | `AccountDrawerContent.tsx`, `accounts/page.tsx`, `dashboard/page.tsx` | Accounts page, Dashboard | Editable forms | Owned by the calling page | Two independent Cash Flow implementations exist (Dashboard's and Accounts' are separate code, not shared) | Same silent-discard behavior |
| **Trade / Planned / Account detail drawers** | `TradeDrawerContent.tsx`, `PlannedDrawerContent.tsx`, `AccountDrawerContent.tsx` | Dashboard, Journal, Planned, Accounts, and their detail pages | Read-only display; Edit/Delete buttons hand off to the modal/dialog above | Same `DetailDrawer` shell | Shared content components, reused between the drawer and the full detail page | Inherits DetailDrawer's closing behavior |
| **NIFTY Tools Drawer** | `src/components/nifty-tools/NiftyToolsDrawer.tsx` | The "Tools" button on every NIFTY page | Read-only launcher list | A small on/off memory shared across all NIFTY pages (not saved anywhere, resets on refresh) | NIFTY-only | Inherits DetailDrawer's closing behavior |
| **Flow Tracker** (fullscreen) | `src/components/nifty-tools/FlowTrackerView.tsx` | The NIFTY Tools Drawer's "Flow Tracker" row | Read-only chart/data exploration | Local to the component | NIFTY-only | Escape key or × (no background click, it's a full-screen panel) |
| **Oracle Tools Drawer** | `src/components/oracle-tools/ToolsLauncherDrawer.tsx` | The "Tools" button on every Oracle page | Read-only launcher list + one live reference panel | Same pattern as NIFTY's | Oracle-only | Inherits DetailDrawer's closing behavior |
| **Full-Screen Analysis** (Score Trend / Indicator Trend / COT Trajectory / Score & COT Comparison) | `src/components/oracle-tools/FullScreenAnalysis.tsx` | Oracle Tools Drawer, or shortcut buttons on Top Setups/Scorecard/Heatmap/COT pages | Read-only; one shared engine powers all 5 of these tools via a config object | Local to the component | Oracle-only, but shared across 5 tool variants | Escape key or × |
| **Pair Correlation** (fullscreen) | `src/components/oracle-tools/PairCorrelationView.tsx` | Oracle Tools Drawer | Read-only, explicitly marked in its own code as a placeholder pending a proper design pass | Local to the component | Oracle-only | Escape key or × |
| **Toast notifications** | `src/components/toast/*` | Anywhere in the app, plus automatically for every failed save/update/delete | Read-only notification | A single global store, not tied to any one page | Fully shared, app-wide | Auto-dismiss timer, or a manual × |

---

## 5 · Shared component map

### Components used by two or more pages

| Component | File | Used by | Coupling risk |
|---|---|---|---|
| **AppShell / Sidebar / TopBar / MainContent / SidebarContext** | `src/components/*` | Every single page in the app, without exception | **Critical** — nothing can be scoped away from this |
| **DetailDrawer** | `DetailDrawer.tsx` | 12+ call sites: Trading, NIFTY, Oracle, both Tools drawers | **High** — the shell's own chrome (header layout, width, closing behavior) is shared by everything that opens a drawer, including two tool-launcher drawers that are otherwise unrelated to Trading |
| **ConfirmDialog** | `ConfirmDialog.tsx` | Every delete flow in Trading | **High** — one component backs every "are you sure you want to delete this" moment in the app |
| **LoadingState / ErrorState** | `state/LoadingState.tsx`, `state/ErrorState.tsx` | Nearly every data-fetching page: Dashboard, all of Trading, all of NIFTY, all of Oracle | **High reach, lower behavioral risk** — purely visual, so the main risk is a layout regression appearing everywhere at once, not broken logic |
| **EmptyState** | `state/EmptyState.tsx` | Most of Oracle and NIFTY (Trading pages write their own local empty-state text instead, so they aren't affected by this one) | Medium |
| **Toast system** | `toast/*` | Everywhere directly, plus automatically wired to fire on every failed save app-wide | **High** — a change to its timing or shape affects every success/error message in the app, including pages that never explicitly ask for a toast |
| **`chartTheme.ts`** | `src/components/oracle-tools/chartTheme.ts` | Oracle's own analysis chart, **plus** NIFTY's Flow Tracker charts and History chart | **High — and the riskiest "hidden" coupling in the app.** Its folder name says "Oracle only," but it quietly reskins NIFTY charts too. |
| **TimeframeControl** | `src/components/shared/TimeframeControl.tsx` | Oracle's Full-Screen Analysis and NIFTY's Flow Tracker | Medium — explicitly documented in its own file as shared between two features whose underlying data-fetching rules differ |
| **ScreenshotUploader / ScreenshotGallery** | `ScreenshotUploader.tsx` | Both trade-entry modals (upload) and three read-only display spots (trade drawer, planned drawer, planned detail page) | Medium |
| **ScoreGauge / ScoreHistoryChart** | `ScoreGauge.tsx`, `ScoreHistoryChart.tsx` | Asset Scorecard and FX Scorecard only | Low-medium — both consumers are within the same feature and use it the same way |
| **Sparkline** | `Sparkline.tsx` | Dashboard and Oracle's COT Report | Low |
| **motion.tsx** (animated numbers, reduced-motion awareness) | `motion.tsx` | Dashboard, Journal, several Oracle/NIFTY pages, plus indirectly powers `ScoreGauge`'s sweep animation | Medium — a timing change here subtly affects the feel of the score gauge too, which is easy to overlook |
| **DetailPageLayout** | `DetailPageLayout.tsx` | The three "full page" detail views (trade, account, planned trade) | Medium — these three pages are meant to look and behave as a matched set |

### Single-consumer components (lower priority, listed for completeness)

`Starfield.tsx` (background canvas, mounted once), the rest of the NIFTY Tools and Oracle Tools file sets (only reachable through their own provider), and a handful of page-specific pieces.

### Files that must never be edited as a side effect of a page-level change

- `src/app/layout.tsx` — wraps every route in the app
- `src/components/AppShell.tsx` — decides whether a page gets the sidebar/topbar chrome at all
- `src/components/Sidebar.tsx`
- `src/components/TopBar.tsx`
- `src/components/MainContent.tsx`
- `src/components/SidebarContext.tsx`
- `src/lib/providers.tsx` — the global data-fetching setup and the automatic error-toast wiring
- `src/lib/auth/auth-context.tsx` — feeds the sidebar's admin check, the top bar's user menu, and the screenshot uploader's login check
- `src/components/toast/*` (all 6 files) — the global notification system
- `src/components/Starfield.tsx` — visible on literally every screen
- `src/components/DetailDrawer.tsx` — shared shell behind 12+ unrelated drawers
- `src/components/ConfirmDialog.tsx` — shared behind every delete action
- `src/components/state/LoadingState.tsx`, `ErrorState.tsx`, `EmptyState.tsx`
- `src/components/oracle-tools/chartTheme.ts` — **despite its Oracle-only-sounding name, this one also controls NIFTY's chart appearance**

---

## 6 · Layout and shell inventory

**Root layout nesting** (`src/app/layout.tsx`), outermost first:

1. A full-screen background star-field animation (purely decorative, sits behind everything)
2. The app's data-fetching setup (React Query)
3. The login/session provider
4. **AppShell** — decides per-page whether to show the sidebar+top-bar chrome at all: pages under `/auth/*` and the root landing page (`/`) get **no chrome**, just their own content; every other page gets the full shell below
5. Inside the shell: **Sidebar** (left), then **MainContent** wrapping **TopBar** (sticky header) above the actual page
6. A global toast notification stack, sitting outside all of the above

**The Sidebar:** the six-item menu described in Section 1.1, plus (desktop only) a collapse/expand toggle, and (mobile only) a slide-out drawer with its own close button and background overlay. It knows which item is "active" purely by checking the current web address. Below roughly 1024px screen width it becomes an off-canvas drawer instead of a fixed rail; above that width it's always visible, either full-width or collapsed to icon-only.

**The Top Bar:** shows a section label (driven by a small lookup table that, notably, only explicitly covers 4 of the app's many sections — everything else falls through to a generic label), a static "Overview" sub-text, a mobile menu toggle, the last-refreshed time, a live "Idle / Fetching / Error" status dot tied to the app's background data-fetching activity, and a user menu (name, "Settings" link, "Sign out"). It also changes height slightly once the page has been scrolled.

**Where the page actually scrolls:** the browser window itself, not some inner scrolling box — this is explicitly called out in a code comment as a deliberate choice. The only exceptions are the detail drawers and the full-screen analysis overlays, which each scroll their own contents internally since they cover the whole screen.

**Breadcrumbs / back buttons:** there is no single shared breadcrumb component. Three different, independently-built mechanisms exist: a back-link-and-title component used only by the three "full page" detail views (trade/account/planned-trade), a hand-written breadcrumb inside the admin Data pages, and the top bar's static section label. They don't share code.

---

## 7 · Styling system inventory

**Tailwind CSS v4**, configured entirely through CSS rather than a separate config file (this is normal for v4, not a gap). PostCSS config only registers the Tailwind plugin itself.

**Two competing color systems currently coexist:**
1. **`src/styles/lucid-theme.css`** — the newer, clean, gold-branded design-token file (`--lucid-*` custom properties): warm surfaces, gold accent, a five-step bearish→bullish color scale, semantic status colors, and elevation/shadow tokens. ~30 reusable utility classes and 12 animation definitions live here too.
2. **`src/app/globals.css`** — still defines a **complete second, independent color palette** in a Tailwind `@theme` block using the old blue/slate scheme (`--color-primary: #3B82F6` and friends), plus a "legacy palette aliases" block that intentionally remaps most (but not all — one purple accent color is explicitly left un-migrated) of the old names onto the new gold tokens.

So the memory note about this codebase being "centralized on gold tokens, with legacy blue lingering" is accurate, but understates it slightly: it isn't just a few leftover values, it's a **second, still-fully-defined theme system sitting alongside the first one**, plus **392 hardcoded color values** (231 hex codes, 161 `rgb()`/`rgba()` values) spread across roughly 50 component files that bypass both token systems entirely and hardcode raw colors — most heavily in the landing page (80 hex + 42 rgba matches alone), the chart theming file, the admin pipeline page, and several auth-flow pages.

**Fonts:** three, loaded via Next.js's built-in font system (no external font-loading tags): Inter (body text), Space Grotesk (headings), IBM Plex Mono (numbers/data).

**No component library** (no Radix, no shadcn, no Headless UI) — every dropdown, drawer, modal, and dialog in the app is hand-built from scratch. The only UI-adjacent dependency is an icon set (`lucide-react`). Charting is done with Recharts and ApexCharts.

**Animation:** no animation library (no Framer Motion) — all motion is either hand-written CSS `@keyframes` (23 of them, across the two CSS files) or small custom React hooks for number count-up and staggered text reveal. The background star field is a hand-coded animated `<canvas>`.

**Dark/light theming:** does not exist in any form. The app is dark-mode-only, hardcoded throughout — there is no toggle, no `prefers-color-scheme` handling, and no light-mode values anywhere.

---

## 8 · Data layer inventory

**Data-fetching approach:** 100% TanStack React Query, consistently. No `SWR`, no plain manual fetching for any actual page data (login/session bootstrapping is the one exception, and that's a reasonable design choice since it happens once at app start rather than per-page). Every data-fetching hook returns the same predictable shape (loading flag, error, the data itself, a refetch function), and loading/error/empty screens are consistently drawn by the page itself using three small shared components, not by the hooks.

**Where the frontend recomputes something the backend could have provided — the most important finding in this section:**

The **NIFTY and Oracle side of the app is well-behaved**: scores, bands, "is this data stale," and reasons are almost all calculated once on the server and delivered ready-made; the frontend mostly just formats and colors what it's given. There are two narrow exceptions (a pattern-matching "is this pattern relevant right now" engine, and a bias-label re-calculation for sub-totals that the backend doesn't itself label) — both are modest in scope.

The **Trading Hub (Journal, Accounts, Analytics, Dashboard, System) is the opposite story**: every statistic shown anywhere in this entire feature area — win rate, expectancy, average R:R, drawdown percentage, equity curves, best/worst pair or model, session performance — is calculated by the browser from raw trade records, because the backend simply returns raw trades and accounts with no summary numbers attached at all. Worse, this math is **written out independently in at least four different places** (`src/lib/stats.ts`, the Analytics page, the Account drawer, and the Dashboard page), each its own copy of similar-but-not-identical formulas. There's no single "this is the official win rate calculation" — there are four, and nothing keeps them in sync if one is ever tweaked without touching the others.

**How staleness is shown to the user:** NIFTY/Oracle data carries genuine backend-provided "this is stale" flags and "last updated" timestamps that the frontend displays plainly. The app deliberately does **not** auto-refresh data when you switch back to the browser tab — refreshing only happens via an explicit "Retry" button or after you save/edit something.

---

## 9 · Type and contract inventory

There is no dedicated shared "types" folder — type definitions live scattered across the API-client files that use them, one file per feature area (NIFTY, Oracle, Trading, USD Lab, Admin, User). Confusingly, the actual source of truth for the Trading domain's core types (Trade, Account, Model, Pair, Planned Trade) is a file literally named `demo-data.ts`, despite being the real, live-data type source — worth renaming at some point, though out of scope for this recon.

**Two duplicated/divergent contracts worth flagging before anyone builds on top of them:**
- A function called `getCycleStances()` exists **twice**, in two different files, calling two different backend addresses, returning two differently-shaped answers under the exact same type name (`CycleStancesResponse`) — one for the admin tool, one for the public Oracle reference panel. They describe the same underlying central-bank data but aren't the same contract.
- A "bias" concept (Strong Bullish → Strong Bearish) is independently defined twice under two different names in two different files, bridged only by unchecked type-casts wherever both are used together.

**Type safety:** the codebase has **zero** uses of the `any` type anywhere — a genuinely clean result. There is a small number of `as X` type-assertion escape hatches, mostly reasonable (narrowing a dropdown's string value back to its known set of options), but a few are worth knowing about: one place reads a `mistakes` field that doesn't exist on the Trade type at all (an intentional escape hatch for an unbuilt feature), and about eight places assume a caught error is a standard `Error` object without actually checking.

---

## 10 · Responsive and accessibility notes

**Breakpoints actually used:** `sm:` and `md:` are used heavily (nearly 300 and 235 times respectively); `xl:` moderately; `lg:` is used sparingly by raw count but is the single most structurally important one — it's the exact point (1024px) where the entire app switches between "sidebar always visible" and "sidebar becomes a slide-out drawer." `2xl:` is essentially unused.

**What breaks on narrow screens:** nothing outright breaks, but every data table in the app (there are many) uses the same strategy: let the user scroll the table sideways rather than restacking it into a mobile-friendly card layout. That's a consistent, deliberate pattern rather than a bug, but it does mean every table-heavy page (Journal, Accounts, Analytics breakdowns, the admin Data pages, Oracle's COT report, etc.) requires horizontal scrolling on a phone.

**Keyboard navigation:** works only to the extent that plain HTML links, buttons, and form fields naturally support it. There is no custom keyboard handling anywhere in the entire codebase — no arrow-key tab switching, no "current tab" announced to screen readers, nothing beyond what a browser gives you for free on an `<a>` or `<button>`.

**Focus handling in drawers/dialogs:** every drawer and dialog in the app (the shared DetailDrawer, ConfirmDialog, and all the fullscreen analysis overlays) correctly announces itself to screen readers as a dialog and closes on the Escape key, but **none of them trap keyboard focus inside themselves, and none of them return focus to whatever was clicked once they close.** A keyboard-only user can Tab straight through an open drawer into the page behind it.

**Reduced-motion support:** genuinely present and reasonably thorough — both in the CSS (five separate places disabling hover/entrance/pulse animations) and in JavaScript (a dedicated hook that the number-counting and star-field animations both check before deciding whether to animate at all).

---

## 11 · Risk register

| # | Item | Where | Why it's a risk | Severity |
|---|---|---|---|---|
| 1 | `chartTheme.ts` is Oracle-named but shared into NIFTY | `src/components/oracle-tools/chartTheme.ts` | A change made "just for Oracle" silently reskins NIFTY's Flow Tracker and History charts too — the single easiest accidental blast-radius mistake in this codebase | **High** |
| 2 | Trading Hub statistics are computed client-side, four times over, independently | `src/lib/stats.ts`, `trading/analytics/page.tsx`, `AccountDrawerContent.tsx`, `dashboard/page.tsx` | No backend number exists to check these against; the four implementations can silently drift from each other | **High** |
| 3 | No focus trap or focus restoration in any drawer/dialog | `DetailDrawer.tsx`, `ConfirmDialog.tsx`, all fullscreen overlays | Keyboard-only users can tab out of an open drawer into the page behind it | **High** |
| 4 | Two independently-defined "central bank stance" contracts with the same name | `src/lib/api/admin.ts`, `src/lib/api/oracle.ts` | `CycleStancesResponse` means two different things depending which file you imported it from | Medium |
| 5 | Two competing color/token systems both still active | `globals.css` (legacy `@theme` block) vs. `lucid-theme.css` | A "simple" color tweak can be undone by the other system still being wired up; migration is not actually finished despite the newer system existing | Medium-High |
| 6 | `AddTradeModal`/`AddPlannedTradeModal`/Cash Flow modals discard typed input with no warning | `AddTradeModal.tsx`, `AddPlannedTradeModal.tsx` | A user who fills out a long form and misclicks the backdrop loses everything silently | Medium |
| 7 | Dead click in the Patterns detail drawer | `nifty/patterns/page.tsx` (Pattern Drawer, "Instance Examples" rows) | Looks clickable, does nothing — a real, findable bug | Medium |
| 8 | Hardcoded fallback counts on the admin Data landing page | `src/app/data/page.tsx` | A genuine "zero indicators" backend problem could be masked by a hardcoded "13" shown whenever the real count is falsy | Medium |
| 9 | Score-history chart x-axis labels are a fixed calendar, not the real dates plotted | `src/components/ScoreHistoryChart.tsx`, `src/data/scorecard.ts` | If the loaded data window doesn't match the hardcoded "Jan 5–Mar 23" assumption, the axis labels are simply wrong | Medium |
| 10 | Every data table uses horizontal-scroll-only mobile responsiveness | App-wide (Journal, Accounts, Analytics, COT Report, admin Data pages, etc.) | Consistent, not a bug, but a real UX rough edge on phones that a redesign should deliberately decide whether to keep | Medium |
| 11 | Top bar's page-title lookup table only covers 4 of the app's many sections | `src/components/TopBar.tsx` | Most pages fall through to a generic label; looks like an incomplete map rather than intentional design | Low-Medium |
| 12 | `/ledger` route exists with no way to reach it from any menu | `src/app/ledger/page.tsx` | Dead weight at minimum; a landmine if someone assumes it's wired up correctly because the top bar has a label ready for it | Low |
| 13 | Three fully-built NIFTY pages (USD Lab, V-Bottom, Velocity) have no permanent navigation entry point | `nifty/layout.tsx` tab list | Likely intentional ("diagnostic tool, not primary tab") but means these pages have no persistent way back to them if reached by a direct link or browser action | Low |
| 14 | Every trading statistics function is called separately inside each rendered card rather than computed once and shared | `trading/system/page.tsx` (Model/Pair/Session cards) | Not a correctness bug (results are the same), but the same math re-runs once per visible card on every render — a performance smell worth knowing about before scaling up that page | Low |
| 15 | "Sessions" tab has no create/edit — auto-tagged only | `trading/system/page.tsx` | Not a bug, just worth knowing before assuming full CRUD parity across the three System sub-tabs | Low (informational) |

---

## Self-Verification

1. **No file was modified, created, moved, renamed, or deleted other than `docs/recon/UI_RECON_v1.md`.** Every other tool call in this recon was a read-only search, file read, or directory listing. Confirmed.
2. **No git command was run.** This working directory was confirmed not to be a git repository at the session's outset in any case; no git command of any kind was issued during this recon.
3. **No install or build command was run.** No `npm install`, `npm run build`, `npm run dev`, or any other package-manager/build command was executed at any point.
4. **Directories read, and coverage:**
   - `src/app/**` (all pages, layouts, and route handlers) — **complete**.
   - `src/components/**` (top-level, plus `nifty-tools/`, `oracle-tools/`, `shared/`, `state/`, `toast/` subfolders) — **complete**.
   - `src/hooks/**` (all 15 hook files) — **complete**.
   - `src/lib/**` (all API client files, auth context, storage, supabase, formatting/stats/pattern-relevance utilities) — **complete**.
   - `src/data/**` (assets, heatmap, scorecard reference data) — **complete**.
   - `src/styles/**` and `src/app/globals.css` — **complete**.
   - Root config: `package.json`, `postcss.config.mjs` — **complete**. No `tailwind.config.*` file exists (expected for Tailwind v4).
   - **Partial/skipped:** the compiled `.next/` build output and `node_modules/` were not read — irrelevant to a source-level UI recon. The `Lucid-Backend` sibling project was not read at all — this recon was explicitly scoped to the frontend only, per the prompt.
5. **Number of `UNKNOWN` findings: 9.** The three most consequential:
   - Whether the live `/api/nifty/patterns` backend data actually still matches the hand-maintained mock pattern list still used by one feature (the Scorecard drawer's "Related Patterns") — cannot be determined without running the backend.
   - Whether the two independently-defined `getCycleStances()` contracts (Section 9) are an intentional two-tier design or accidental drift — the backend source isn't part of this frontend-only recon.
   - Whether the `ScoreHistoryChart` fixed-calendar label mismatch (Risk #9) is currently producing visibly wrong dates in production, or has simply not yet been exercised with a mismatched date range — this requires live data, not static reading.
6. **Anything in the prompt I was unable to complete, and why:** Nothing was skipped outright. Every numbered section (1–13) was completed using only static code reading, exactly as instructed. Where the code didn't make something determinable (see the 9 `UNKNOWN`s), I wrote that explicitly rather than inferring from filenames or guessing at intent.
7. **One thing worth knowing before redesign begins that may not be anticipated:** the app already has a **second, half-migrated design-token system quietly still switched on** (Section 7) — this isn't leftover dead code, it's a fully-defined, currently-active alternate color palette sitting in `globals.css` alongside the newer gold-token system in `lucid-theme.css`. A redesign that only touches `lucid-theme.css` and assumes that's "the" token file will leave this second system's colors reachable and could reintroduce old blue/slate tones in unexpected places. This should be resolved (either by finishing the migration or by explicitly deciding to keep both, on purpose) before or during the redesign, not discovered partway through it.
