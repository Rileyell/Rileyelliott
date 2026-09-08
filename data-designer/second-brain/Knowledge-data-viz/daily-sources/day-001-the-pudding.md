---
created: 2026-08-04
last_edited: 2026-08-04
version: 1.0
provenance: con_tiWG7ca2cp5JPZUn
day: 1
source_name: The Pudding
source_url: https://pudding.cool
access_verified: 2026-08-04
---

# Day 1 — The Pudding: Production Pipeline, Process, and Storytelling Anatomy

## Why This Source

The Pudding is the only major organization in data visualization that has published a **complete, documented end-to-end production process** for data-driven visual storytelling. Every other resource in the knowledge base focuses on either design principles (Cairo, Knaflic), chart selection (FT Visual Vocabulary, Datawrapper), academic rigor (Munzner, Ware), or finished example portfolios. The Pudding does something different: it shows the *workflow* — from question to data to storyboard to code to publish — with real examples of what gets killed and why.

This fills a gap no existing resource covers: **how do you actually make a data story, from idea to production?**

Their documented process is also remarkable for what it admits: many ideas are abandoned. Saying goodbye to a story is part of the craft, not a failure. This framing is uncommon in data visualization pedagogy, where most resources show finished work.

**Access:** ✅ Fully free — all process articles are agent-readable. The main essays library is free. Tutorials on the resources page are free.

---

## Source Inventory

| URL | Title | What It Contains |
|---|---|---|
| https://pudding.cool/resources/ | Our Resources | Index of all process documentation: how-to blogs, live coding episodes, presentations, FAQ |
| https://pudding.cool/process/pivot-continue-down/ | Continue, Pivot, or Put It Down | The full decision flowchart from idea to publication — the core workflow document |
| https://pudding.cool/process/how-to-make-dope-shit-part-3/ | Making Internet Things, Part 3: Storytelling | Anatomy of a data-driven story: audience, scope, complexity, structure |
| https://pudding.cool/process/no-code-charts/ | How to Recreate Our Charts Without Code | Tool-agnostic chart production — Datawrapper, Flourish, Figma, scrollytelling |
| https://pudding.cool/about/ | About | Organizational philosophy — end-to-end ownership, experimentation, craft-first culture |

---

## The Core Workflow: Continue, Pivot, or Put It Down

Source: https://pudding.cool/process/pivot-continue-down/ — Amber Thomas, August 2020

The Pudding's production process is structured as a series of decision gates. At each gate, the team decides whether to continue, pivot direction, or abandon the story (either temporarily or permanently). More paths lead to "put it down" than to "publish" — but that's intentional. The point is that saying goodbye is an acceptable outcome at any stage.

### Gate 1 — Do you have a unique question that can be answered with data?

Two sub-questions are always asked together:

**Is the question unique?** Has someone already answered this? If yes, can you tell it with a genuinely new angle? (Example: A story about abortion clinic access had been done, but The Pudding's version used *driving times* — a new data angle that qualified it as unique.)

**Can it be answered with data?** "Why are women's pockets so small?" is a question but not a data-answerable one. "How much smaller are women's pockets than men's?" is answerable by measurement. Reframing the question to be data-answerable is part of the scoping process.

**Failure mode at this gate:** Moving forward on a question that someone has answered better, or on a question that sounds interesting but can't be operationalized as data.

**Real example put down at this stage:** Matt and Jan were interested in YouTube speedrun videos (Summoning Salt) and tried to find a data-viz angle. After data collection and storyboarding, they couldn't find a way that added to the conversation. Killed.

---

### Gate 2 — Do the data exist? Can you collect them? Is it ethical?

**Open sources first:** Kaggle, data.world, CDC, government portals, Wikipedia scrapes, TripAdvisor, PetFinder. Many Pudding stories are built on pre-existing open data.

**Manual collection when necessary:** For the women's pockets story, Jan and Amber physically went to stores and measured pockets. For a boyband story, volunteers watched every music video and recorded appearance data. For a dress code story, Amber manually read hundreds of school dress codes.

Manual collection is time-consuming and may not yield interesting results — go in prepared for that.

**Ethical check:** Even if data exist, ask whether the use and interpretation are appropriate. Using data for a purpose other than its original intent requires an honesty check.

---

### Gate 3 — Are you the right person to tell this story?

If no, collaborate with someone who is — or put the story down. This is a positionality and identity question, not a skills question. If the story is about a community you're not part of, bringing in a collaborator or co-author is the responsible path.

---

### Gate 4 — Create a plan. Is the story still interesting?

Storyboarding happens here: what charts are needed, what do they show, how does the narrative flow from the data findings? This is where many ideas die — what seemed interesting as a question may not yield enough to fill a visual essay.

If the plan is still compelling, move to making.

---

### Gate 5 — Make the thing. Is it still interesting?

Build it. Then review: does the thing you made actually answer the original question? Is the data robust? Is the narrative flow engaging? If not, fix it or kill it.

**Note from Thomas:** "There are a lot more paths that lead to put it down than there are that lead to publish it. That doesn't mean that we actually scrap more stories than we publish. It just means that saying goodbye (even for a period of time), pivoting directions, and continuing forward are all acceptable options at any of these junctures."

---

## Storytelling Anatomy: Part 3 of "How to Make Dope Shit"

Source: https://pudding.cool/process/how-to-make-dope-shit-part-3/ — Ilia Blinderman

This guide covers the structure of a data-driven story, moving from broad principles to specific structural decisions.

### Question 1 — Who is your audience?

**Passion project (yourself):** Allows maximum experimentation, creative risk-taking, and personal voice. The constraint is absent, which can lead to meandering — but it enables genuine novelty. Downside: harder to tell when it's done.

**Others (work product):** Constraints focus the story. Less time means the core takeaway must be prioritized. The discipline imposed by a deadline or editorial relationship is a productive forcing function, not just a limitation.

**Takeaway:** Passion projects allow greater originality. Work for others produces more focused, clearer stories. Neither is better — know which you're making.

### Question 2 — Is your focus broad or narrow?

**Broad (dataset-first):** You have a corpus that's inherently interesting (decades of advice column letters, a century of NYT front pages). Exploration is the starting point. The risk: boiling the ocean and finding nothing. The insight must still be found and foregrounded — the exploration is not the story.

**Narrow (question-first):** The tried-and-true approach. Start with a specific, debatable, data-answerable question. Easier to scope, easier to communicate to an audience, easier to structure. Examples: "Is Seattle actually rainier than other cities?" "Which rappers have the richest vocabularies?"

**Takeaway:** Question-first is lower-risk. Dataset-first requires more tolerance for dead ends and more editorial skill to surface the right insight.

### Question 3 — How complex is the core finding?

**Simple/accessible finding:** Lead with a "sledgehammer stat" — the most striking finding, presented immediately. This hooks the reader and makes all subsequent points feel more relevant. (Example: Blink-182 topped a list of most controversial "punk" bands — reveal this first, then explore subgenres and age effects.)

**Complex finding:** Don't lead with the complexity. Build up context, explain terms, scaffold the reader's understanding before landing the central point.

**Structure implication:** Simple insight → sledgehammer opening. Complex insight → scaffolded narrative, reveal later.

### Structural Principle — Distribute story across charts and text

Charts carry the data. Text carries the interpretation, context, and transitions. Avoid:
- Charts that need paragraphs of explanation to be understood (the chart failed)
- Text that merely redescribes what the chart already shows (wasted space)

The ideal: the chart delivers the visual fact; the caption states the interpretive takeaway; the prose handles transitions, context, and nuance.

### Transparency principle — The Method section

The Pudding includes a Methods section (usually after the conclusion) on every story that:
- Lists all data sources and how data was collected
- Describes any calculations or models applied
- Notes exclusions, limitations, and caveats
- Is written for a reader who wants to evaluate the work critically

This is not optional. It is what makes the story credible. Readers who distrust the analysis will look for this; readers who trust it will rarely read it — but its presence signals rigor.

---

## No-Code Production: How to Recreate Our Charts Without Code

Source: https://pudding.cool/process/no-code-charts/

This is The Pudding's documentation of chart production without custom code — directly applicable when working in dashboards and report contexts rather than full web essays.

### Tool Stack (No-Code Tier)

| Tool | Use Case |
|---|---|
| Google Sheets / Excel | Data organization, initial charting, export to CSV |
| Datawrapper | Interactive charts for publication — bar, line, scatter, map. Exports SVG for refinement |
| Flourish | Charts and data stories including scrollytelling variants (Enterprise license for full scroll features) |
| Figma with Auto Layout | Static chart design — bars, waffle charts, treemaps, strip plots, dot plots, heatmaps, pictograms |
| Figma plugin: Datavizer | Extends Figma for chart-type production |

### Scrollytelling without code

Sequential social images or Flourish tappable stories can achieve scroll-driven narrative effects without custom JavaScript. Good enough for most use cases; custom code (Scrollama.js) is only necessary for highly specific interaction patterns.

### Design principle from this piece

Even The Pudding's most visually ambitious work starts as a spreadsheet and a sketch. The production path is: data → no-code prototype → evaluation → (if warranted) custom build. Jumping straight to custom code wastes time on ideas that don't survive the prototype review.

---

## Organizational Philosophy

Source: https://pudding.cool/about/

**End-to-end ownership:** Each essay is researched, analyzed, designed, written, and coded by one person (or a small team). This prevents the communication gaps that happen when separate teams own each stage — the person who understands the data is also the person making design decisions.

**Experimentation over safety:** Many ideas are killed during production. The Pudding pursues "unproven, novel visual approaches to push the craft forward." This means a high rate of internal failure is built into the process — it's not a bug, it's the cost of doing work at the frontier.

**The public backlog:** The Pudding maintains a public backlog of ideas — questions they're considering, sourced from team members' daily lives. Most will never become stories. The backlog practice is itself a skill: building the habit of noticing questions that might have data-answerable forms.

---

## Full Resource Map

```
The Pudding — Complete Access Map
──────────────────────────────────────────────────────────────
PROCESS DOCUMENTATION (core value for Data Designer persona)
  1. Continue, Pivot, or Put It Down (decision flowchart)
     https://pudding.cool/process/pivot-continue-down/

  2. Making Internet Things, Part 3: Storytelling
     https://pudding.cool/process/how-to-make-dope-shit-part-3/

  3. How to Recreate Charts Without Code
     https://pudding.cool/process/no-code-charts/

  4. All process resources indexed at:
     https://pudding.cool/resources/

METHODOLOGY EXAMPLES (live essays with methods sections)
  Any Pudding essay → scroll to end → "Methods" section
  Annotated examples of this pattern:
    - "When Women Make Headlines" (NLP + data journalism)
      https://pudding.cool/2022/02/women-in-headlines/
    - "How Rigid is the Middle Class?" (PSID longitudinal data)
      https://pudding.cool/2020/08/income/

TOOLS DOCUMENTED IN THEIR PROCESS
  - Svelte (front-end framework for interactive essays)
  - D3.js (custom visualizations)
  - R, Python, SQL, Node.js (data processing)
  - Datawrapper, Flourish (no-code charts)
  - Figma (static chart design)
  - Scrollama.js (scrollytelling)
```

---

## When to Use This Source

| Situation | What to Pull From |
|---|---|
| Starting a new data story from scratch | Continue/Pivot/Put It Down flowchart — gate-by-gate checklist |
| Deciding whether to kill a project in progress | Gate 5 review: does the thing answer the original question? |
| Choosing between broad/dataset-first vs. narrow/question-first approach | Part 3: Q2 (Focus: Broad or Narrow?) |
| Structuring the narrative of a finished analysis | Part 3: Q3 (Complexity → sledgehammer stat vs. scaffolded reveal) |
| Adding a methods section to a chart or report | Transparency principle + their published methods section pattern |
| Prototyping charts without writing code | No-code production tier: Datawrapper → Flourish → Figma |
| Explaining to a stakeholder why an idea was dropped | "Saying goodbye is an acceptable outcome at any stage" — frame this explicitly |

---

## Key Terms Introduced by This Source

**Idea backlog** — A personal or team-maintained list of questions and observations from daily life that might eventually become data stories. The practice of maintaining one is itself a skill.

**Continue / Pivot / Put It Down** — The three acceptable outcomes at each decision gate. Pivoting (changing direction) and putting down (killing the story, temporarily or permanently) are not failures — they are part of the craft.

**Sledgehammer stat** — The single most striking finding, presented at the opening of a story when the core insight is simple and accessible. Leading with the best material hooks the reader.

**Methods section** — Post-conclusion documentation of data sources, collection methods, calculations, exclusions, and limitations. Required for credibility. The Pudding publishes this on every essay.

**End-to-end ownership** — One person (or small team) owns research, analysis, design, writing, and code for a single story. Prevents translation loss between specialists.

---

*Added: 2026-08-04 | Day 1 of the daily source series | Source verified agent-readable: yes*
