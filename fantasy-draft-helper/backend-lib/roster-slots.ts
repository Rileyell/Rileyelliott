// Turns a league's raw roster_positions array (Sleeper's native format, and
// the format ESPN's lineupSlotCounts is normalized into — see leagues.ts)
// into exact starting-slot counts. This is the single source of truth for
// "how many of each position can I actually start" — used to keep AI
// recommendations (chat.ts, team.ts) from suggesting more starters at a
// position than the league allows, regardless of how good a bench player's
// ranking looks.

// Fallback used only when a league has no captured roster_positions yet
// (e.g. legacy ESPN configs synced before that capture existed).
export const DEFAULT_ROSTER_POSITIONS = [
  "QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "FLEX", "K", "DEF",
  "BN", "BN", "BN", "BN", "BN",
];

export interface RosterSlots {
  // Exact-position starting slots, e.g. { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1 }
  exact: Record<string, number>;
  // Flex-type slots and their eligible positions, e.g. [{ label: "FLEX", eligible: ["RB","WR","TE"], count: 2 }]
  flex: Array<{ label: string; eligible: string[]; count: number }>;
  benchCount: number;
  irCount: number;
}

// Sleeper/ESPN both use "DEF" or "DST" for team defense depending on source —
// normalize to DEF for exact-slot counting, but keep both aliases matchable.
const DEF_ALIASES = new Set(["DEF", "DST"]);

// Flex-type slot labels → which real positions they accept. Order matters
// for FLEX vs SUPER_FLEX vs REC_FLEX disambiguation is not needed since each
// label maps to a fixed eligible set.
const FLEX_ELIGIBILITY: Record<string, string[]> = {
  FLEX: ["RB", "WR", "TE"],
  WRRB_FLEX: ["RB", "WR"],
  REC_FLEX: ["WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  OP: ["QB", "RB", "WR", "TE"], // ESPN's "offensive player" slot, same as superflex
  IDP_FLEX: ["DL", "LB", "DB"],
};

export function parseRosterSlots(positions: string[] | null | undefined): RosterSlots {
  const list = positions && positions.length > 0 ? positions : DEFAULT_ROSTER_POSITIONS;
  const exact: Record<string, number> = {};
  const flexCounts = new Map<string, number>();
  let benchCount = 0;
  let irCount = 0;

  for (const raw of list) {
    const pos = DEF_ALIASES.has(raw) ? "DEF" : raw;
    if (pos === "BN") { benchCount++; continue; }
    if (pos === "IR") { irCount++; continue; }
    if (pos in FLEX_ELIGIBILITY) {
      flexCounts.set(pos, (flexCounts.get(pos) ?? 0) + 1);
      continue;
    }
    exact[pos] = (exact[pos] ?? 0) + 1;
  }

  const flex = Array.from(flexCounts.entries()).map(([label, count]) => ({
    label, eligible: FLEX_ELIGIBILITY[label], count,
  }));

  return { exact, flex, benchCount, irCount };
}

// Renders a compact, LLM-friendly summary of hard starting-slot limits, e.g.
// "QB: 1, RB: 2, WR: 2, TE: 1, FLEX (RB/WR/TE): 2, K: 1, DEF: 1 — 5 bench spots".
export function formatRosterSlots(slots: RosterSlots): string {
  const parts: string[] = [];
  for (const [pos, count] of Object.entries(slots.exact)) {
    parts.push(`${pos}: ${count}`);
  }
  for (const f of slots.flex) {
    parts.push(`${f.label} (${f.eligible.join("/")}): ${f.count}`);
  }
  const slotsStr = parts.join(", ");
  return `${slotsStr} — ${slots.benchCount} bench spot${slots.benchCount === 1 ? "" : "s"}${slots.irCount ? `, ${slots.irCount} IR` : ""}`;
}

// Total startable count for a given position, counting flex slots it's
// eligible for. Used to tell the LLM "you have N total slots this player
// could occupy" rather than just the exact-position count.
export function maxStartableAt(slots: RosterSlots, position: string): number {
  const pos = DEF_ALIASES.has(position) ? "DEF" : position;
  let total = slots.exact[pos] ?? 0;
  for (const f of slots.flex) {
    if (f.eligible.includes(pos)) total += f.count;
  }
  return total;
}
