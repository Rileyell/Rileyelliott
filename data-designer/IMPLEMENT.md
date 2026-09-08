---
created: 2026-09-08
last_edited: 2026-09-08
version: 1.0
provenance: con_XCsPl93lMboybzeI
---

# Implementing Riley Voss, Data Designer, on a new Zo account

A custom AI persona for data-viz critique — full backstory, working style, and a compounding
data-visualization knowledge base — blind-graded against Claude and Gemini on an 8-question
data-viz judgment exam (93/100). This project has two parts: the **showcase site** (this folder)
and the **persona itself** (`second-brain/`), which are separate things that both need setting up.

## What's in this folder

- The site source (`server.ts`, `src/pages/persona-showcase.tsx`, etc.) — displays the benchmark
  writeup and results.
- `second-brain/Documents-System/` — the persona's identity file
  (`personas/data-designer-soul.md`), anchor scorecards (v1.0 and v2.0), and every benchmark round
  (prompts, rubrics, responses, results) that produced the 93/100 score shown on the site.
- `second-brain/Knowledge-data-viz/` — the compounding knowledge base the persona draws on
  (foundational + advanced data-viz resources, an index, references, and daily-sources notes).

## Steps

### 1. Recreate the persona
1. In the new Zo account, go to Settings → AI → Personas → Create Persona.
2. Name it (e.g. "Riley Voss, Data Designer") and paste the contents of
   `second-brain/Documents-System/personas/data-designer-soul.md` as the prompt.
3. Copy `second-brain/Knowledge-data-viz/` into the new account's workspace at
   `Knowledge/data-viz/` — this is the reference material the persona is meant to draw on when
   critiquing charts. Copy `second-brain/Documents-System/` to `Documents/System/` similarly, so
   future benchmark rounds have somewhere to log results consistent with the existing ones.

### 2. Deploy the showcase site
1. Create a new Zo Site (blank variant).
2. Copy everything in this folder except `second-brain/` and `IMPLEMENT.md` into the new site
   directory.
3. Check `zosite.json` ports for conflicts; change if needed.
4. `bun install` (uses the included `bun.lock`).
5. Run dev, verify `persona-showcase.tsx` renders the benchmark results correctly, then publish.

## Notes

- The showcase site is static content (benchmark results already written up) — it doesn't call
  the live persona at runtime, so it'll work immediately without step 1. Step 1 is only needed if
  you want to actually *use* Riley Voss as an active persona going forward, not just display the
  past benchmark.
- If you want to run new benchmark rounds under the new account, follow the existing pattern in
  `second-brain/Documents-System/viz-benchmark-*` files (prompt → rubric → response → results) to
  keep methodology consistent with what's already published.
