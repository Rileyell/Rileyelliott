---
name: faq-chatbot
description: Drop-in AI chatbot for any FAQ dashboard. Answers questions from the scraped FAQ knowledge base for a specific event slug. Uses Minimax via the concentrate.ai endpoint. Add it to any new FAQ dashboard in two steps — deploy the shared API route (once) and embed the widget (per page).
compatibility: Created for Zo Computer
metadata:
  author: rileye.zo.computer
  created: 2026-07-16
  last_edited: 2026-07-16
  version: 1.0.0
  provenance: con_UAB9IDzK9xUL1DOs
---

# FAQ Chatbot Skill

Adds an AI-powered chat widget to any FAQ dashboard page. The chatbot reads its knowledge directly from the event's scraped `faq_data.json` file (populated by the `web-scraper` skill), keyed by event slug from the FAQ Dashboard's event registry.

## How it works

1. User asks a question in the chat widget on a dashboard page.
2. The widget POSTs `{ slug, question, history }` to `/api/faq-chat`.
3. The API reads the event registry (`faq-dashboard/data/faq-events.json`) to find the `dataFile` path for that slug.
4. It loads all published FAQ entries from `faq_data.json`, grouped by milestone, and builds a system prompt.
5. The question + context is sent to Minimax (`minimax-m2-1-highspeed` via `concentrate.ai`).
6. The answer streams back to the widget.

**Knowledge source:** Whatever the web-scraper deposited into the event's `faq_data.json`. Run a scrape first, publish the entries in the admin, then the chatbot knows about them automatically.

## Prerequisites

- `MINIMAX_API_KEY` set in [Settings > Advanced](/?t=settings&s=advanced) under Secrets.
- The event must exist in `faq-dashboard/data/faq-events.json`.
- At least some FAQ entries with `status: "published"` in that file.

## Install

### Step 1 — Deploy the shared API route (once per zo.space, not per event)

Create a zo.space API route at `/api/faq-chat` using the contents of `assets/routes/api-faq-chat.ts`.

```
write_space_route("/api/faq-chat", "api", <contents of assets/routes/api-faq-chat.ts>)
```

Deploy it on each new account — routes don't carry over between Zo accounts.

### Step 2 — Embed the widget in a dashboard page

In the page route for the event's FAQ dashboard, add the widget. Two options:

**Option A — Use the reusable component (recommended for new dashboards):**
Copy `assets/widget/FaqChatWidget.tsx` into the page route file and render:
```tsx
<FaqChatWidget slug="your-event-slug" accentColor="#7C3AED" />
```
Change `accentColor` to match the event's brand color from `faq-events.json`.

**Option B — Inline (for existing pages like `/faq`):**
The `/faq` page already has the widget inlined. When adding to a new event page, prefer Option A.

## Adding a new event dashboard

When a new event is created in the hub and you want its dashboard to have the chatbot:

1. Ensure the event has a `dataFile` in `faq-events.json` (set automatically when the event is created).
2. Run a scrape via the hub admin to populate `faq_data.json`.
3. Publish the FAQ entries via the admin page (`/faq-event-admin?slug=<slug>`).
4. Create the client page route (e.g. `/faq-tnc`) and embed `<FaqChatWidget slug="tnc-2026" />`.
5. The chatbot immediately knows all published FAQs for that event.

## Config reference

In `assets/routes/api-faq-chat.ts`:

| Constant | Default | What to change |
|---|---|---|
| `REGISTRY_PATH` | `$FAQ_REGISTRY_PATH`, else `/home/workspace/faq-dashboard/data/faq-events.json` | Set the env var if the dashboard lives elsewhere |
| `ORG_NAME` | `$FAQ_CHAT_ORG_NAME`, else none | Adds "powered by …" to the bot's intro |
| `CONTACT_EMAIL` | `$FAQ_CHAT_CONTACT_EMAIL`, else none | Where the bot sends out-of-scope questions |
| `MINIMAX_API_URL` | `https://api.concentrate.ai/v1/chat/completions` | Only if endpoint changes |
| `MINIMAX_MODEL` | `minimax-m2-1-highspeed` | Swap for a faster/smarter model |

All event-specific config (program name, data file path) is driven by the registry — no code changes needed per event.

## Files

- `assets/routes/api-faq-chat.ts` — The zo.space API route. Deploy once.
- `assets/widget/FaqChatWidget.tsx` — Reusable React widget component. Embed per page.
