---
created: 2026-08-12
last_edited: 2026-08-25
version: 2.0
provenance: con_3Jn9MKqAwLlYvpeM
---

# Data Designer Benchmark 3 — Model Comparison Results

Grading `Claude Benchmark 3.pdf`, `Gemini Benchmark 3.pdf`, and `Zo Benchmark 3.pdf` against `viz-benchmark-3-parametric-rubric.md`. Same 8 questions, same rubric, applied consistently across all three.

## Methodology (v2.0 — supersedes the 2026-08-12 self-graded pass)

The original 2026-08-12 run was graded by Zo, the same system that produced one of the three entries under evaluation — a conflict of interest that was never disclosed at the time, despite the rubric's own instructions explicitly calling for blind grading in this situation. That run has been superseded by this one.

This pass follows the rubric's stated protocol: the three PDF responses were extracted to plain text, stripped of any identifying labels, randomly assigned to "Response A / B / C," and handed to a fresh grading agent with no knowledge of which label corresponded to which model and no access to the original (biased) results. Model identities were revealed only after scores were locked. Full record: `blind_grading_mapping.txt` and `anonymized_responses.txt` in the grading session's workspace.

## Final Scores

| Model | Score (v2.0, blind) | Score (v1.0, self-graded — superseded) | vs. target (≥80) |
|---|---|---|---|
| **Claude** | **99/100** | 98/100 | Pass, near-perfect |
| **Zo** | **93/100** | 92/100 | Pass |
| **Gemini** | **84/100** | 79/100 | Pass |

The ranking is unchanged from the original self-graded pass (Claude > Zo > Gemini), and all three scores moved within a few points — Gemini gained the most (+5), crossing the ≥80 maturity target it had previously missed. This suggests the original conflict of interest did not produce a large self-preferencing effect in this instance, but it should have been disclosed regardless, and blind grading is the correct default going forward per the rubric's own protocol.

## Per-Question Breakdown

| Q | Max | Claude | Gemini | Zo |
|---|---|---|---|---|
| 1. Averages vs. distribution | 13 | 13 | 11 | 11 |
| 2. Color palette, 6-cat scatter | 12 | 12 | 10 | 12 |
| 3. Data-rich vs. cluttered | 12 | 12 | 9 | 12 |
| 4. Pie chart conditions | 12 | 12 | 10 | 10 |
| 5. Slope vs. grouped bar | 12 | 12 | 12 | 10 |
| 6. B&W substitution | 12 | 12 | 10 | 12 |
| 7. Preattentive processing | 13 | 13 | 10 | 13 |
| 8. Dual-axis risk | 14 | 13 | 12 | 13 |
| **Total** | **100** | **99** | **84** | **93** |

## Rationale by Question

**Q1 — Averages vs. distribution.** All three correctly diagnosed the mean-hides-skew problem and recommended box/violin/strip plots. Claude's citation (Weissgerber et al., *Beyond Bar and Line Graphs*, PLOS Biology 2015) is the most precisely on-point — the specific paper making this exact argument — for full credit. Gemini's Anscombe's Quartet citation is defensible but adjacent, not precisely on-point. Zo gave strong content (adds a median+IQR fallback) but cited no source at all despite one being available.

**Q2 — Color palette.** Claude and Zo both hit the full structure (2 poor / 2 good) with precise mechanisms and named palettes (ColorBrewer, Okabe–Ito, Ware). Gemini's second "good" choice ("high contrast against background") is generic and doesn't map to a specific rubric criterion.

**Q3 — Data-rich vs. cluttered.** Claude and Zo both explicitly state the signal-to-noise framing with sharp concrete examples (spaghetti chart → small multiples). Gemini names Tufte and is directionally correct, but doesn't explicitly articulate the signal-vs-noise nuance and its concrete example is thinner.

**Q4 — Pie chart conditions.** Claude is the only response to hit all four rubric conditions explicitly, including the easy-to-miss "won't be compared to another pie" caveat. Zo and Gemini each cover three of the four conditions and both miss the pie-vs-pie comparison caveat.

**Q5 — Slope vs. grouped bar.** Claude and Gemini both covered the reverse case (when a bar chart is preferable) and named a source. Zo's forward-case content was precise (crossing lines, group-count legibility) but cited no source and didn't cover the reverse case, costing it relative to the other two.

**Q6 — B&W substitution.** Claude and Zo both named several distinct, specific substitute encodings with a named source (Naomi Robbins; Tufte/Few). Gemini named solid, specific techniques but cited no source.

**Q7 — Preattentive processing.** Claude and Zo both nailed the rubric's exact definition components (parallel processing, sub-250ms, no serial search) with correct channels and sourcing. Gemini's definition is directionally correct but omits the parallel-processing/no-serial-search framing the rubric flags as the key distinction.

**Q8 — Dual-axis risk.** All three correctly name the arbitrary-axis-scaling risk rather than a vague "it's confusing." Claude and Zo both cite a precise source (Few's essay by title; Cairo); Gemini gives a valid narrow justified case but cites no source.

## Cross-Model Patterns

- **Nobody fell into the "never use pie charts" trap** on Q4 — all three gave the nuanced, conditional answer the rubric rewards.
- **Sourcing is Gemini's consistent weak point** — it's the only response to skip citations on multiple questions where one was clearly available (Q1 adjacent-only, Q3, Q6, Q8 all uncited).
- **Zo's weak point is citation discipline on the questions where it has the strongest content** — best-in-set or tied-best on Q2, Q3, Q6, Q7, but skips sourcing on Q1 and Q5, and misses the pie-vs-pie caveat on Q4.
- **Claude is the most consistent across all 8 questions** and the only response to explicitly cover both directions of the Q5 comparison and all four Q4 conditions.

## Ranking

1. **Claude — 99/100.** Most consistent across all 8 questions; explicitly covers both directions of the Q5 comparison and all four Q4 pie-chart conditions; best overall citation precision.
2. **Zo — 93/100.** Content depth matches or leads Claude on several questions (Q2, Q3, Q6, Q7), but inconsistent sourcing discipline costs it on Q1 and Q5.
3. **Gemini — 84/100.** Crosses the ≥80 maturity target on this blind pass. Correct and well-organized throughout, but consistently the thinnest on concrete examples and cites sources least often.
