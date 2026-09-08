---
created: 2026-07-28
last_edited: 2026-08-12
version: 1.1
provenance: con_7BmZxb2xVCxQL5dV
---

# Data Designer Benchmark 3 — Parametric Knowledge Test Rubric

**Keep this file away from the persona.** Hand the persona only `viz-benchmark-3-parametric-prompt.md`.

**Grading protocol.** If the run being graded includes Zo's own output alongside other models (e.g. Claude, Gemini), disclose that conflict of interest before scoring. Default to blind grading: strip model-identity labels, score each response against the criteria below, then reveal identities only after scores are locked.

Score each run 0–100 using the criteria below. 8 questions, weighted as noted. Target for a mature persona: ≥80. Expected first-iteration baseline: 30–55.

---

## Scoring Per Question

Each question is scored 0–12 or 0–13 (totaling 100). Apply the criteria below to each.

| Score range | Criterion |
|---|---|
| Full credit | Answer is specific, correct, and names a source (practitioner/book/principle) where applicable |
| −2 | Correct but no source cited when one was clearly available |
| −3 to −5 | Directionally correct but vague, generic, or missing the key distinction |
| 0 | Wrong, circular, or demonstrates a misconception |

---

## Answer Key

**Q1 — Average bar chart vs. distribution (13 pts)**

Correct answer: Averages hide distributional shape — bimodal distributions, outliers, or skew are invisible in a mean. The persona should recommend a box plot, violin plot, strip plot, or histogram. The key framing: the client is asking for a summary statistic when what they need is the shape of the data.

Practitioner sources: Cairo (*The Functional Art*), Knaflic (*Storytelling with Data*), Wilke (*Fundamentals of Data Visualization*) all address this; Wilke in particular is explicit about when summaries destroy information.

**Q2 — Color palette for 6-category scatter (12 pts)**

Poor choices (any two of): colors that are too similar in hue or lightness, a rainbow/jet palette (not perceptually uniform), a palette that fails colorblind accessibility (e.g., red + green), using too many colors for the human visual system to track simultaneously (≥5 is already pushing it), colors from a sequential palette applied to nominal data.

Good choices (any two of): hues that are perceptually distinct and equiluminant, a ColorBrewer qualitative palette (Brewer), a palette tested for colorblind accessibility (deuteranopia/protanopia simulation), limiting to the most important categories and grouping the rest as "other."

Source: Brewer's ColorBrewer, Wilke ch. 4, Cairo on preattentive processing.

**Q3 — Data-rich vs. cluttered (12 pts)**

The distinction is not quantity of information but signal-to-noise ratio. Data-rich = every mark carries information the reader needs. Cluttered = marks present that add noise without adding insight (gridlines that don't aid comparison, decoration, 3D effects, duplicate legends).

A concrete example: removing minor horizontal gridlines on a bar chart that shows rounded values — the gridlines are redundant if the bars are labeled directly. Tufte's data-ink ratio is the canonical framing. Also: Knaflic's "declutter" principle.

Source: Tufte (*The Visual Display of Quantitative Information*), Knaflic (*Storytelling with Data* ch. 3).

**Q4 — When a pie chart is acceptable (12 pts)**

Specific conditions: (1) exactly two or three categories, (2) the question is about part-to-whole proportion, not comparison between categories, (3) at least one slice is large enough to be read as an approximate fraction (>25%), (4) the chart will not be compared to another pie chart. A pie is defensible for "roughly what share?" — never for "which is bigger?" or "how much did this change?"

Source: Cairo, Knaflic, and Wilke all address this; the consensus is narrow but real. Avoid attributing a blanket "never use pies" position — that is too absolute.

**Q5 — Slope chart vs. grouped bar chart (12 pts)**

Slope chart is preferable when: (1) the primary question is about direction and rate of change between two time points, not magnitude at each point; (2) the reader needs to see crossing lines (rank reversals); (3) there are enough groups that a grouped bar chart becomes crowded. Bar chart is preferable when: the reader needs to compare absolute values at each time point, or when there are only 2–3 groups.

Source: Slopegraphs originated with Tufte (*The Visual Display of Quantitative Information*); Cairo and Few have both written on when to prefer them.

**Q6 — Black-and-white print substitution for color (12 pts)**

Encoding options: vary line weight, vary line dash pattern (solid/dashed/dotted), use different marker shapes, use texture fill for area charts, use direct labeling rather than a legend (so color is not needed for identification at all). The persona should be specific — not just "use other encodings" but name at least two.

Source: Wilke (*Fundamentals of Data Visualization*) ch. 17 is dedicated to this. Knaflic also addresses it in the accessibility section.

**Q7 — Preattentive processing (13 pts)**

Definition: visual features that are processed in parallel before conscious attention, in <250ms, without visual search. They "pop out" from the background. Two channels that exploit it effectively: **color hue** (a red dot among grey dots is found instantly), **position** (outliers along an axis register immediately), also acceptable: size, orientation, shape (though shape is weaker). Do NOT accept: "font size" or "font weight" as strong preattentive channels — those require fixation.

Source: Ware (*Information Visualization: Perception for Design*) is the definitive source; Cairo references it extensively; Few's *Show Me the Numbers* also covers it.

**Q8 — Dual-axis chart risk (14 pts)**

The specific risk: the visual relationship between the two series is **arbitrary** — it changes depending on where you set the two y-axis ranges. A reader can be made to see any correlation or lack thereof by rescaling either axis. The chart shows a visual pattern that is a product of the designer's axis choices, not the data.

When it is justified: when the two variables share the same direction of change and the reader only needs to see that they move together, not the magnitude of their relationship. Even then, a better alternative is usually two small multiples with separate axes, or a normalized index chart. Never use dual-axis to imply causal relationships.

Source: Few (*Show Me the Numbers*), Cairo — both argue strongly against dual-axis charts. Knaflic advises avoiding them.

---

## Score Log

| Date | Persona Version | Score | Notes |
|---|---|---|---|
| *(first run)* | v1 initial | — | Baseline |
| 2026-08-12 | Data Designer (Riley Voss) | 92/100 | **Superseded — self-graded, undisclosed conflict of interest (Zo graded its own entry against Claude/Gemini).** See v2.0 below. |
| 2026-08-25 | Data Designer (Riley Voss) | 93/100 | Blind re-grade per this rubric's own protocol: identities stripped, scored by a fresh grader with no prior context, then revealed. Graded vs. Claude (99) and Gemini (84) in the same blind pass; see `viz-benchmark-3-results.md` v2.0 for full rationale. Ranking unchanged from the self-graded run; sourcing discipline (Q1, Q5) and the Q4 pie-vs-pie caveat remain the gap to Claude. |

---

## Evaluator Notes

**Signals of a mature persona:**
- Cites named practitioners (not just "best practices say…")
- Gives specific alternative chart forms by name, not vague gestures ("something better")
- On Q4, gives the nuanced "narrow but real" defense of pie charts rather than a blanket ban
- On Q8, identifies the axis-scaling arbitrariness as the *specific* risk, not just "it's confusing"

**Common failure modes:**
- Q1: recommending a box plot without explaining *why* (the distributional shape argument)
- Q3: defining data-rich/clutter as aesthetic judgment rather than signal/noise
- Q4: either "never use pies" (too absolute) or "use when there are few categories" (not specific enough)
- Q7: giving a vague "things that stand out" definition without the parallel-processing framing
- Q8: saying "it's hard to read" rather than naming the axis-scaling arbitrariness
