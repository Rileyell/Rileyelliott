---
created: 2026-07-24
last_edited: 2026-07-24
version: 1.0
provenance: con_mpGZi1jrs3P05yFM
---

# Data Designer Benchmark — Task Brief

You are Riley Voss, Data Designer.

A client has provided the following dataset. Your job is to produce **three chart recommendations** — not three charts of the same thing, but three charts that together tell a coherent story about what is happening in this data.

---

## The Dataset

**Context:** A professional sports scouting organization tracks how long it takes prospects to sign after an initial offer is extended. The table below shows 24 prospects across three talent tiers over two consecutive draft cycles.

| Prospect | Tier | Draft Cycle | Days to Sign | Offer Outcome |
|---|---|---|---|---|
| P01 | Elite | 2024 | 4 | Signed |
| P02 | Elite | 2024 | 7 | Signed |
| P03 | Elite | 2024 | 12 | Signed |
| P04 | Elite | 2024 | 31 | Withdrew |
| P05 | Elite | 2025 | 3 | Signed |
| P06 | Elite | 2025 | 5 | Signed |
| P07 | Elite | 2025 | 9 | Signed |
| P08 | Elite | 2025 | 6 | Signed |
| P09 | Mid | 2024 | 18 | Signed |
| P10 | Mid | 2024 | 22 | Signed |
| P11 | Mid | 2024 | 45 | Withdrew |
| P12 | Mid | 2024 | 38 | Signed |
| P13 | Mid | 2025 | 14 | Signed |
| P14 | Mid | 2025 | 19 | Signed |
| P15 | Mid | 2025 | 27 | Signed |
| P16 | Mid | 2025 | 33 | Withdrew |
| P17 | Dev | 2024 | 29 | Signed |
| P18 | Dev | 2024 | 51 | Signed |
| P19 | Dev | 2024 | 44 | Withdrew |
| P20 | Dev | 2024 | 62 | Signed |
| P21 | Dev | 2025 | 21 | Signed |
| P22 | Dev | 2025 | 35 | Signed |
| P23 | Dev | 2025 | 48 | Withdrew |
| P24 | Dev | 2025 | 55 | Signed |

---

## What You Must Deliver

For **each of the three charts**, provide:

1. **Chart title** — as it would appear on the final chart
2. **Caption** — one plain sentence stating the takeaway. Must work without axis labels.
3. **Chart type** — name the specific form (e.g. "strip plot", "box plot with jitter", "slope chart")
4. **Encoding spec** — what maps to what: x-axis, y-axis, color, shape, size — only what is used
5. **Rejected alternative** — one chart type you considered and why you ruled it out
6. **Design notes** — color handling, grid, annotation decisions, anything non-obvious

Then write a **1-paragraph Story Arc** explaining how the three charts work together as a sequence — what the viewer learns in order.
