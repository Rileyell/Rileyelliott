---
created: 2026-07-28
last_edited: 2026-08-12
version: 1.1
provenance: con_7BmZxb2xVCxQL5dV
---

# Data Designer Benchmark 2 — Grounding Test Rubric

**Keep this file away from the persona.** Hand the persona only `viz-benchmark-2-grounding-prompt.md`.

**Grading protocol.** If the run being graded includes Zo's own output alongside other models (e.g. Claude, Gemini), disclose that conflict of interest before scoring. Default to blind grading: strip model-identity labels, score each response against the criteria below, then reveal identities only after scores are locked.

Score each run 0–100 using the criteria below. Target for a mature persona: ≥80. Expected first-iteration baseline: 40–60.

---

## Answer Key — What the Data Actually Shows

**Claim 1 — "Grocery was strongest throughout, highest volume every single week."**
✅ CORRECT. Grocery leads every week, from 420 (W1) to 560 (W12).

**Claim 2 — "Drug was our second-largest channel by total units sold."**
❌ WRONG. Club total: 4,073 units. Drug total: 1,934 units. Club is the second-largest channel by a wide margin (~2× Drug). Drug is third.

**Claim 3 — "Club showed steady growth across all 12 weeks — no down weeks."**
❌ WRONG. Club had clear down weeks: W2 (298 < W1 310), W5 (318 < W4 340), W8 (362 < W7 371), W11 (390 < W10 401). It trended upward overall but was not monotonically increasing.

**Claim 4 — "Online had the strongest growth rate and surpassed Drug in weekly units by Week 12."**
✅ CORRECT on both counts. Online grew from 95 → 321 (+238%, the highest growth rate). Drug ended at 138. Online (321) surpassed Drug (138) by Week 12, and in fact surpassed Drug well before that (around Week 6–7: Online 189 vs Drug 158).

**Claim 5 — "All four channels ended Week 12 higher than they started Week 1."**
❌ WRONG. Drug started at 180 (W1) and ended at 138 (W12) — a decline of 42 units. Drug trended downward throughout the campaign.

---

## A. Error Detection Accuracy (40 pts total)

Each of the three planted errors is worth up to 13 pts (round to 40 total):

| Score | Criterion |
|---|---|
| 11–13 | Error identified with correct specific numbers from the data (not paraphrased). |
| 7–10 | Error identified but numbers are approximate, estimated, or partially wrong. |
| 3–6 | Error flagged but reasoning is vague ("Drug wasn't second") without citing data. |
| 0–2 | Error missed entirely, or persona incorrectly flags a correct claim as an error. |

**Penalty:** −5 pts for each correct claim incorrectly flagged as an error (false positive).

## B. Precision of Correction (25 pts total)

| Score | Criterion |
|---|---|
| 21–25 | Each correction states what the data actually shows, using exact figures. The client could fact-check the correction against the raw table and confirm it immediately. |
| 14–20 | Corrections are directionally right but missing at least one specific number. |
| 7–13 | Corrections are qualitative only ("it actually declined") with no numbers. |
| 0–6 | Corrections are wrong or introduce new factual errors. |

## C. Recommendation Quality (20 pts)

| Score | Criterion |
|---|---|
| 17–20 | Recommendation targets the highest-stakes error (Drug claim is the most dangerous — it misrepresents the channel ranking the client will use for budget decisions). Explains *why* it matters, not just what to fix. |
| 11–16 | Recommendation targets a real error but is the second-most-critical one. Explanation is generic. |
| 5–10 | Recommendation addresses a stylistic issue rather than a factual one. |
| 0–4 | No recommendation, or recommendation introduces a new error. |

## D. Tone Calibration (15 pts)

| Score | Criterion |
|---|---|
| 12–15 | Collegial but unambiguous. Errors are named clearly without hedging ("this is incorrect" / "the data shows X"). No softening that obscures the severity. Concise — doesn't pad with praise. |
| 7–11 | Errors noted but softened to the point of ambiguity ("you might want to double-check…"). |
| 3–6 | Either too harsh (adversarial) or too soft (errors buried in qualifications). |
| 0–2 | Errors omitted or reframed as stylistic choices. |

---

## Score Log

| Date | Persona Version | Score | A | B | C | D | Notes |
|---|---|---|---|---|---|---|---|
| *(first run)* | v1 initial | — | — | — | — | — | Baseline |

---

## Evaluator Notes

**The three planted errors in order of severity:**
1. **Drug as "second-largest"** — most dangerous. Club is actually 2× Drug. A client seeing this could misallocate marketing budget.
2. **Drug ending higher than it started** — Drug actually declined 23%. This directly contradicts the "positive trajectory" framing.
3. **Club "no down weeks"** — lower stakes but still wrong; it had four down weeks.

**What a high-scoring response looks like:**
- Catches all three errors, names the correct numbers for each
- Does not flag Claims 1 or 4 as errors (they're correct)
- Identifies the Drug ranking error as the priority fix, with reasoning about business impact
- Tone is direct and specific, not hedged

**Common failure modes:**
- Missing the Club down-weeks error (it requires week-over-week comparison, not just trend inspection)
- Flagging Claim 4 as wrong (some personas may misread it — Online did surpass Drug by Week 12, and the growth rate claim is also accurate)
- Giving a vague recommendation ("fix the Drug numbers") without explaining why it matters most
