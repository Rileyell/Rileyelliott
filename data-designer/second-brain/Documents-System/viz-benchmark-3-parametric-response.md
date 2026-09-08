---
created: 2026-08-12
last_edited: 2026-08-12
version: 1.0
provenance: con_zqLZanyGpXT2Uytg
---

# Data Designer Benchmark 3 — Parametric Knowledge Test
## Responses (Riley Voss, Data Designer)

**1. A client wants to show the distribution of customer response times across four product categories. They ask for a bar chart showing the average response time per category. What do you tell them, and what do you recommend instead?**

I'd tell them a bar chart of averages hides exactly the thing they probably care about: variance, skew, and outliers. Response time distributions are almost always right-skewed (a few very slow outliers drag the mean up), so the "average" bar can misrepresent the typical customer experience entirely. I'd recommend a box plot or, better, a strip/jitter plot or violin plot per category — something that shows the median, spread, and outliers simultaneously rather than collapsing everything to one number. If the audience needs something simpler, a dot plot showing median + IQR per category is a reasonable middle ground.

**2. You are encoding a categorical variable with six values on a scatter plot using color. Name two specific things that would make your color palette a poor choice, and two things that would make it a good one.**

Bad: (1) using a sequential/gradient palette (light-to-dark blue) on unordered categories — it falsely implies rank or intensity where none exists; (2) picking hues that are close in hue-angle at similar saturation (e.g., blue/purple, orange/red), which fail for colorblind viewers and are hard to discriminate even for typical vision. Good: (1) a purpose-built qualitative palette like ColorBrewer's Set2/Dark2 or Tableau 10, engineered for maximal, evenly-spaced hue separation at six-or-fewer categories; (2) verifying the palette against a colorblind simulator (deuteranopia/protanopia) so no two categories collapse into the same apparent color — this is Cynthia Brewer's core contribution to categorical color design.

**3. What is the difference between a chart that is data-rich and one that is cluttered? Give a concrete example of a design decision that moves a chart from the second category to the first.**

This is Tufte's data-ink ratio: clutter is ink spent on anything that isn't data (3D bevels, heavy gridlines, drop shadows, redundant legends), while data-rich means high information density where nearly every mark encodes something. The two can look visually similar in "busyness" but differ in whether that busyness carries information. Concrete example: a chart with faint or removed gridlines, direct end-of-line labels instead of a color-keyed legend, and small multiples instead of an overlaid spaghetti chart — you've kept (or increased) the amount of information shown while cutting the non-data ink that made it feel cluttered.

**4. When is a pie chart an acceptable choice? Be precise — describe the specific conditions that make it defensible, not just "when there are few categories."**

Precisely: when there are 2–3 (at most ~4–5) categories, they represent parts of one meaningful whole that sums to 100%, and the communicative goal is "this one slice dominates/is roughly half" rather than precise comparison between similarly-sized slices. Stephen Few's standard here is that pie charts work only for gross, single-glance proportion judgments — the moment you need someone to compare two slices that are close in size, angle/area judgment (per Cleveland & McGill's perceptual ranking) is worse than length, and a bar chart wins. If a client wants exact percentages read off individual slices, that's the tell it should be a bar chart instead.

**5. A slope chart and a grouped bar chart can both show change between two time points for multiple groups. When would you choose the slope chart over the bar chart, and why?**

I'd choose the slope chart when the point is the change itself — direction, magnitude, and rank-reordering across groups — rather than the absolute values at each timepoint. A slope chart's line angle is preattentively read (steep up vs. down, or crossing lines indicating rank swaps) in a way a grouped bar chart can't match, because with bars the viewer has to serially compare adjacent bar-pair heights and mentally compute the delta. This advantage compounds as the number of groups grows — a slope chart stays legible with 8–10 groups, while a grouped bar chart with that many pairs becomes visually noisy and the deltas get lost.

**6. You are designing a chart for a printed annual report that will be photocopied in black and white. You had planned to use color to distinguish three data series. What do you do instead?**

Drop hue as the encoding channel entirely and switch to shape/pattern: distinct line styles (solid, dashed, dotted) for line charts, or hatching/texture fills for bars, combined with direct labeling so the reader isn't dependent on a legend. I'd also make sure value/lightness contrast is high enough to survive photocopying, since color-only distinctions that rely on similar luminance (e.g., red vs. green) disappear completely in grayscale. This is the standard fallback in Tufte's and Few's work: encode categorical distinction with a channel that survives the reproduction medium, not just the original screen.

**7. What does "preattentive processing" mean in the context of visualization, and name two visual channels that exploit it effectively?**

Preattentive processing (Colin Ware's term, building on Treisman's feature-integration work) refers to visual properties the brain registers pre-consciously, in under ~200–250ms, without requiring serial scanning — the viewer "just sees" the pattern before they've consciously looked for it. Two channels that exploit this well: position/length (the most accurate channel per Cleveland & McGill's perceptual ranking, which is why bar charts and scatterplots work so well) and color hue (fast for pop-out/outlier detection, e.g., spotting the one red dot among gray dots). Size and orientation also qualify but are lower-precision than position.

**8. A colleague says: "I used a dual-axis chart so I could show revenue and customer count on the same chart." What is the specific design risk of a dual-axis chart, and when (if ever) is it justified?**

The specific risk is that the two axes' scales are chosen independently and arbitrarily, so you can make any two unrelated series appear correlated (or uncorrelated) just by adjusting the axis ranges — this is Alberto Cairo's core critique of dual-axis charts as a vector for "how to lie with charts." It's rarely justified; the honest alternatives are indexing both series to a common baseline (e.g., % change from period 1) on a single axis, or using small multiples/two stacked panels sharing an x-axis. The narrow case where it's defensible is when the two series are in genuinely different, non-comparable units but the relationship between their shapes (not magnitudes) is the entire point, and you label both axes with zero ambiguity about their independent scaling.
