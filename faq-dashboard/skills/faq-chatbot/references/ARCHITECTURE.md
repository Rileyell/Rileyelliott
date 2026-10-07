---
created: 2026-07-16
last_edited: 2026-07-16
version: 1.0
provenance: con_UAB9IDzK9xUL1DOs
---

# Architecture

## Data flow

```
Client widget (FAQChatWidget)
  │  POST /api/faq-chat  { slug, question }
  │
  ▼
api-faq-chat.ts
  │
  ├─ Read faq-dashboard/data/faq-events.json  (or $FAQ_REGISTRY_PATH)
  │    └─ Find event by slug → get dataFile, program name, client name
  │
  ├─ Read event.dataFile (faq_data.json)
  │    └─ Filter to status=published entries (up to 80)
  │    └─ Format as Q/A blocks with milestone + audience tags
  │
  ├─ Build system prompt (program identity + full FAQ block)
  │
  └─ POST to https://api.concentrate.ai/v1/chat/completions
       model: minimax-m2-1-highspeed
       └─ Return { response, success }
```

## Knowledge base source

**`faq_data.json`** — written by `web-scraper/faq_extract.py`. Each entry has `question`, `answer`, `milestone`, `audience`, `status`. Only `published` entries are sent to the model.

## Why a shared API route (not per-event routes)

The slug is passed at request time, so one deployed route serves every event. Adding a new event requires:
- Registering it in `faq-events.json` (done in the hub)
- Scraping + approving FAQs (done in the admin)
- Rendering `<FAQChatWidget slug="..." />` in the dashboard page

No route changes, no redeploys.

## Token budget

`MAX_ENTRIES = 80` caps the FAQ entries sent to the model. At ~60 tokens per Q/A pair that's ~4800 tokens of context, well within Minimax's window. Adjust the constant in `api-faq-chat.ts` if events grow significantly larger.

## Error states surfaced to the user

| Condition | HTTP | Message |
|-----------|------|---------|
| Missing `slug` | 400 | "slug is required" |
| Unknown slug | 404 | "No event found for slug X" |
| No published entries | 422 | "No published FAQ entries found — scrape and publish first" |
| Missing `MINIMAX_API_KEY` | 500 | Instructions to add secret |
| Minimax API error | 502 | "AI model error (status)" |
