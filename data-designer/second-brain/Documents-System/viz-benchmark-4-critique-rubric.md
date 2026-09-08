---
created: 2026-07-28
last_edited: 2026-08-12
version: 1.1
provenance: con_7BmZxb2xVCxQL5dV
---

# Data Designer Benchmark 4 — Chart Critique Test Rubric

**Keep this file away from the persona.** Hand the persona only `viz-benchmark-4-critique-prompt.md`.

**Grading protocol.** If the run being graded includes Zo's own output alongside other models (e.g. Claude, Gemini), disclose that conflict of interest before scoring. Default to blind grading: strip model-identity labels, score each response against the criteria below, then reveal identities only after scores are locked.

Score each run 0–100. Target for a mature persona: ≥80. Expected first-iteration baseline: 40–60.

---

## Answer Key

**The chart's core problems (decision-specific, not generic):**

**Problem 1 — 3D Perspective Distortion on the Comparison Slices**
APAC (18%) and LATAM (7%) are positioned at the back/right of the tilt. The 3D perspective compresses them visually, making the gap between them appear smaller than it is — and making APAC appear smaller relative to North America than the 18% figure suggests. The wrong conclusion: "APAC and LATAM look similar in size — maybe LATAM is worth the same investment." The actual gap is 18% vs. 7% — more than 2.5×. The 3D distortion collapses that gap.

**Problem 2 — Mixed categories in a single encoding**
The chart encodes both geographic regions (North America, Europe, APAC, LATAM, MEA) and sales channels (Direct Sales, Channel Partners) as equal slices of the same pie. These are different dimensions. The 10% in Direct Sales is not a geographic market — it could include revenue from North America, APAC, and LATAM. The wrong conclusion: "We have 38% North America + 10% Direct Sales — does that 10% represent additional APAC opportunity or is it already counted there?" The client cannot answer the geographic expansion question because the denominator is contaminated with channel data.

**The single most important fix:**
Remove the channel segments (Direct Sales, Channel Partners) from the pie and represent only geographic regions. This is the foundational fix because it makes the chart answer the geographic question. No amount of fixing the 3D perspective or label size matters if the category mix remains. A client cannot make a geographic expansion decision from a chart that mixes geography and channel in the same encoding.

**The replacement chart:**
A horizontal bar chart sorted by revenue percentage (largest to smallest), geographic regions only, 2D, single color with the APAC and LATAM bars highlighted (different fill or label treatment) to make the comparison direct. Title: "APAC Holds 2.5× LATAM's Current Revenue Share — Expansion Decision Hinges on Growth Rate, Not Size." Or equivalent finding-first title. Optional: a second version with a YoY growth column alongside the static % share, since the static snapshot alone doesn't answer whether LATAM is growing faster.

**What the analyst got right:**
The analyst included percentage labels directly on the slices rather than requiring the viewer to decode the legend entirely — direct labeling is a real principle (though the 6pt font undermines it). Alternatively: the analyst included all geographic regions including MEA (1%), which ensures the dataset is complete, not selectively filtered to only "interesting" regions.

**What does NOT count as a strong answer:**
- "The pie chart is bad because pie charts are bad" — too generic
- "The colors are hard to distinguish with 7 slices" — true but not decision-specific
- "The title should be a finding" — valid but not tied to the APAC/LATAM decision specifically

---

## A. Two Problems (40 pts total, 20 per problem)

| Score per problem | Criterion |
|---|---|
| 16–20 | Problem is named precisely (not just "3D is bad" but "3D tilt compresses the back-right slices, specifically APAC and LATAM, collapsing a 2.5× real gap"). The specific wrong conclusion the client would reach is stated. The tie to the APAC vs. LATAM expansion decision is explicit — not a generic visualization principle. |
| 10–15 | Problem is identified correctly. Wrong conclusion is implied but not stated. Tie to the decision is present but generic ("makes it harder to compare"). |
| 4–9 | Problem is named but framed generically ("3D charts are bad," "mixed categories confuse readers"). No specific wrong conclusion, no tie to the expansion decision. |
| 0–3 | Problem is wrong (misidentifies a real element as a problem), absent, or purely cosmetic (font size, color choice not tied to a decision error). |

**Note:** Both problems must be *distinct*. Identifying two consequences of the same problem (e.g. "3D makes APAC look smaller" and "3D makes LATAM look larger") counts as one problem identified twice. Deduct 5 pts from the second problem score if this occurs.

## B. Most Important Fix (20 pts)

| Score | Criterion |
|---|---|
| 16–20 | Identifies removing the channel segments (Direct Sales, Channel Partners) as the foundational fix. Explains why this fix must come first: the geographic question cannot be answered from a chart that mixes geography and channel, regardless of other improvements. |
| 10–15 | Identifies either the 3D perspective or the mixed categories as the most important fix. If 3D perspective: answer is defensible (fixing the visual distortion is a real improvement) but misses that the category mix makes the comparison conceptually invalid, not just visually imprecise. Partial credit for a clear, justified argument even if it's not the strongest answer. |
| 4–9 | Names the most important fix but does not explain *why* it matters more than the others. "Remove the 3D" without explaining what wrong conclusion it prevents in this specific decision context. |
| 0–3 | Cannot identify a most important fix, or names a cosmetic fix (font size, legend placement). |

## C. Replacement Chart (25 pts)

| Score | Criterion |
|---|---|
| 20–25 | Chart type is appropriate for comparing 5 geographic segments by revenue share (horizontal bar chart, dot plot, or lollipop chart — all acceptable). Encoding spec includes: axis (what maps to x, what maps to y), color handling with explicit treatment for APAC and LATAM as the comparison subjects, and a 2D form. Title is a finding — states what the chart shows as a conclusion ("APAC holds 2.5× LATAM's current share") not a label ("Revenue by Region"). Optional: notes that the static share alone is insufficient and a growth rate dimension is needed to answer the expansion question. |
| 13–19 | Chart type is appropriate. Encoding spec is present but partial (missing explicit APAC/LATAM highlight treatment, or title is descriptive). |
| 6–12 | Chart type is appropriate but no encoding spec — or encoding spec is present but chart type is wrong for the task (e.g. line chart for unordered categories, another pie chart). |
| 0–5 | Cannot recommend a replacement, recommends another 3D or pie chart, or provides no encoding spec. |

## D. One Thing the Analyst Got Right (15 pts)

| Score | Criterion |
|---|---|
| 12–15 | Identifies something genuinely defensible: direct labeling of percentages on slices (even if the font size undermined it), complete geographic coverage including MEA at 1% (data integrity over selective filtering), or including both channel and geographic breakdowns in a single chart (legitimate ambition, wrong execution — channels matter for the expansion decision, just not mixed into the geographic encoding). The response names the principle behind the decision — not just "the labels are there" but "direct labeling reduces the decode burden the viewer carries." |
| 7–11 | Identifies something real but frames it generically ("the data is there," "it includes all regions"). Does not connect it to a named principle or explain what the analyst was trying to accomplish. |
| 3–6 | Identifies something cosmetic and frames it as a virtue ("the colors are different shades" / "the title is present"). |
| 0–2 | Cannot find anything defensible, or backhanded framing ("the only thing they got right was including APAC at all"). |

---

## Score Log

| Date | Persona Version | Score | A | B | C | D | Notes |
|---|---|---|---|---|---|---|---|
| *(first run)* | v1 initial | — | — | — | — | — | Baseline |

---

## Evaluator Notes

**What separates baseline from mature on this benchmark:**

Section A is the critical separator. A baseline response will catalog generic problems ("pie charts make it hard to compare," "7 colors in a legend is too many," "3D is always bad"). A mature response ties every critique to the specific decision the client is trying to make — the APAC vs. LATAM expansion — and names the specific wrong conclusion that each problem enables.

**The mixed categories problem (Problem 2) is the harder one to catch.** Most personas will identify the 3D distortion immediately. The mixed-category problem requires noticing that "Direct Sales" and "Channel Partners" are dimensionally incompatible with geographic regions in the same encoding — they are a different axis entirely. This is a real, subtle design error, not a generic "too many categories" complaint.

**Watch for:** A persona that names both problems correctly but writes identical resolutions (both say "remove the 3D") is likely pattern-matching to known heuristics without actually reading the data description. Deduct in Section A if the resolution is the same for both problems.

**Knowledge base signal:**
- Knaflic: "every element on a chart should earn its place by reducing cognitive load or adding information"
- Cairo: charts are arguments — a flawed chart makes a wrong argument
- Tufte: data-ink ratio — Direct Sales / Channel Partners slices are high-ink, low-geographic-signal elements
- Wilke: mixing ordinal categories (region by revenue) with nominal categories (channel type) in a single encoding is a category error

**What a 90+ response looks like:**
- Problem 1: Names 3D tilt distortion, calls out that APAC/LATAM are in the compressed back-right quadrant, states the wrong conclusion ("the gap looks like 18% vs. 9%, not 18% vs. 7%")
- Problem 2: Names mixed-category encoding, explains that Direct Sales revenue could include APAC and LATAM revenue, making the geographic percentages uninterpretable
- Fix: Restate the question as geographic-only, remove channel segments
- Chart: Horizontal bar, 2D, APAC and LATAM bars highlighted, finding title
- Defense: Direct labeling attempt was correct — the principle was right, the execution (6pt font) failed it
