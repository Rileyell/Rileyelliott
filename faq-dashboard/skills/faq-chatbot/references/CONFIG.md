---
created: 2026-07-16
last_edited: 2026-07-16
version: 1.0
provenance: con_UAB9IDzK9xUL1DOs
---

# FAQ Chatbot — Configuration Reference

## API route constants (`/api/faq-chat`)

```ts
const REGISTRY_PATH =
  process.env.FAQ_REGISTRY_PATH || "/home/workspace/faq-dashboard/data/faq-events.json";
const ORG_NAME = process.env.FAQ_CHAT_ORG_NAME || "";
const CONTACT_EMAIL = process.env.FAQ_CHAT_CONTACT_EMAIL || "";
const MINIMAX_API_URL = "https://api.concentrate.ai/v1/chat/completions";
const MINIMAX_MODEL = "minimax-m2-1-highspeed";
```

Change `MINIMAX_MODEL` to swap to a different Minimax variant. Set `FAQ_CHAT_ORG_NAME` /
`FAQ_CHAT_CONTACT_EMAIL` to brand the bot's intro and fallback contact.

## Widget props

```tsx
<FaqChatWidget
  slug="tnc-2026"
  accentColor="#10B981"
  apiPath="/api/faq-chat"
  greeting="Hi! Ask me anything about The Nest Climate Campus program."
/>
```

## Event registry shape (faq-events.json)

Each event entry must have at minimum (`dataFile` is relative to the registry's folder;
if omitted it defaults to `<slug>/faq_data.json`):

```json
{
  "slug": "tnc-2026",
  "name": "The Nest Climate Campus 2026",
  "program": "The Nest Climate Campus 2026",
  "dataFile": "tnc-2026/faq_data.json"
}
```

## faq_data.json entry shape

The chatbot reads any entry where `status` is `"published"` or absent:

```json
{
  "id": "...",
  "question": "What is the application deadline?",
  "answer": "Applications close on September 30.",
  "milestone": "Application",
  "audience": "Applicants",
  "status": "published"
}
```

Entries with `status: "draft"` are excluded from the knowledge base automatically.

## Adding a new event

1. Add the event to `faq-events.json` with a `dataFile` path.
2. Run the web-scraper to populate `faq_data.json` (or add entries manually via the admin page).
3. Publish entries via the admin page.
4. Add `<FaqChatWidget slug="new-slug" />` to the client dashboard page.
5. Done — no API redeployment needed.
