---
created: 2026-07-24
last_edited: 2026-08-12
version: 1.1
provenance: con_7BmZxb2xVCxQL5dV
---

# Data Designer Benchmark — Scoring Rubric

**Keep this file away from the persona.** Hand the persona only `viz-benchmark-prompt.md`.

**Grading protocol.** If the run being graded includes Zo's own output alongside other models (e.g. Claude, Gemini), disclose that conflict of interest before scoring. Default to blind grading: strip model-identity labels, score each response against the criteria below, then reveal identities only after scores are locked.

Score each run 0–100 using the criteria below. Target for a mature persona: ≥80. Expected first-iteration baseline: 35–55.

---

## A. Chart-Task Match (30 pts total, 10 per chart)

| Score | Criterion |
|---|---|
| 9–10 | Chart type is the optimal form for the cognitive task required (compare, distribute, change-over-time, rank). Reasoning is explicit. |
| 6–8 | Chart type is defensible but not optimal. Reasoning present. |
| 3–5 | Chart type is plausible but shows default-selection behavior. Little reasoning. |
| 0–2 | Chart type is wrong for the task (e.g. pie chart for distribution, line chart for unordered categories). |

## B. Caption Quality (20 pts total, ~6–7 per chart)

| Score | Criterion |
|---|---|
| 6–7 | Caption states the specific insight, not a description. Works without axis labels. No vague language. |
| 3–5 | Caption references the insight but requires the chart to decode it ("the blue bars are higher"). |
| 0–2 | Caption describes the chart structure rather than the finding ("this chart shows days to sign by tier"). |

## C. Encoding Decisions (20 pts total)

| Score | Criterion |
|---|---|
| 16–20 | Color used as encoding not decoration. Rejected alternatives named with specific reasons. Colorblind-safe default stated or implied. |
| 10–15 | Color decisions present but defaults used without explanation. Rejections partial. |
| 4–9 | Missing explicit color handling or rejected alternatives absent. |
| 0–3 | Color choices unjustified or clearly decorative. No alternatives considered. |

## D. Story Arc Coherence (20 pts)

| Score | Criterion |
|---|---|
| 16–20 | Three charts form a deliberate sequence. Each chart adds a dimension the prior chart could not show. Paragraph is specific — names the charts and the order. |
| 10–15 | Charts feel related but sequence is not clearly motivated. Paragraph is generic ("together these paint a picture…"). |
| 4–9 | Charts are three separate answers to three separate questions, not a narrative sequence. |
| 0–3 | No story arc. Charts are disconnected. |

## E. Knowledge Base Signal (10 pts)

| Score | Criterion |
|---|---|
| 8–10 | Persona explicitly names a specific practitioner (Knaflic, Cairo, Tufte, Wilke, Yau, etc.), a specific principle, or a specific pattern from the knowledge base as justification for at least one decision. |
| 4–7 | Generic reference to visualization principles without naming sources. |
| 0–3 | No reference to the knowledge base or practitioner literature. |

---

## Score Log

| Date | Persona Version | Score | A | B | C | D | E | Notes |
|---|---|---|---|---|---|---|---|---|
| *(first run)* | v1 initial | — | — | — | — | — | — | Baseline |

---

## Evaluator Notes

**What improves section by section as the knowledge base compounds:**

- **A** — improves as the persona internalizes cognitive-task matching (Cairo, Knaflic). Look for it to move from bar-chart defaults toward distribution-aware forms (strip plot, box-and-jitter, slope chart).
- **B** — improves as the persona practices writing captions before finalizing charts (a stated behavioral habit in the persona spec). Early runs will describe the chart. Later runs will state the finding.
- **C** — improves as the persona learns to treat Withdrew/Signed as an encoding variable, not a color decoration. Also: colorblind-safe palette acknowledgment is a signal.
- **D** — improves as the persona stops producing three isolated answers and starts building a deliberate viewing sequence. The correct arc is roughly: scale/distribution → outcome → year-over-year change.
- **E** — is 0 on the first run if the knowledge base is empty. Any score here signals the persona has logged and internalized practitioner material.

**What a high-scoring response looks like:**
- Chart 1: strip plot or box-with-jitter showing the full distribution of days-to-sign by tier (not an average bar chart)
- Chart 2: a form that encodes Withdrew vs. Signed as a meaningful dimension — e.g. dot plot with outcome as shape or position, not just color
- Chart 3: slope chart or connected dot plot for 2024→2025 median shift per tier
- Captions that read as findings, not descriptions
- At least one named practitioner as justification
