---
created: 2026-09-08
last_edited: 2026-09-08
version: 1.0
provenance: con_XCsPl93lMboybzeI
---

# Implementing the FAQ Dashboard on a new Zo account

Point it at any website URL — it scrapes the content, auto-generates FAQ categories and audience
types, and publishes a searchable public FAQ hub with an embedded AI chatbot, plus an admin
dashboard for reviewing/editing entries before they go live.

## What's in this folder

The site itself (`server.ts`, `backend-lib/faq-api/*`, `src/pages/*`), seed data in `data/`
(existing FAQ events including the `zo-faqs` example set), and a `skills/` folder containing the
three Zo Skills this app depends on: `web-scraper` (the scrape + extraction pipeline),
`faq-chatbot` (the embeddable AI widget), and `email-allowlist-gate` (the OTP-based admin auth).

## Steps

1. **Create a new Zo Site** (blank variant) for the dashboard itself.
2. **Copy everything in this folder except `skills/` and `IMPLEMENT.md`** into the new site
   directory.
3. **Install the 3 dependent Skills first** — this app calls into them, so they need to exist
   under the new account's `Skills/` folder before the site will fully work:
   ```bash
   cp -r skills/web-scraper /home/workspace/Skills/web-scraper
   cp -r skills/faq-chatbot /home/workspace/Skills/faq-chatbot
   cp -r skills/email-allowlist-gate /home/workspace/Skills/email-allowlist-gate
   ```
   Read each `SKILL.md` — `web-scraper` needs `crawl4ai`/`beautifulsoup4` installed for deep
   crawls, and `faq-chatbot` calls a Minimax endpoint (see its SKILL.md for the exact API).
4. **Set the admin allowlist.** `backend-lib/faq-api/otp-send.ts` has an `ALLOWED_EMAILS` array
   currently set to a placeholder (`you@example.com`). Replace it with the real admin email(s) —
   and note the same array is duplicated in `faq-hub.tsx` and `faq-event-admin.tsx` (three
   copies by design, not an oversight — keep them in sync).
5. **Check `zosite.json` ports** don't conflict with anything already running; change if needed.
6. `bun install` (uses the included `bun.lock`).
7. **Set secrets** in Settings → Advanced → Secrets: `ZO_API_KEY` (for scraping/chat calls that
   go through the Zo API) and anything the `faq-chatbot` skill's Minimax endpoint requires — see
   `skills/faq-chatbot/SKILL.md`.
8. Run dev (`bun run dev`), create a new FAQ event by pointing the scraper at a target URL, review
   generated entries in the admin dashboard, then publish.

## Notes

- `data/faq-events.json` and `data/*/faq_data.json` are existing seed content from the original
  deployment (including a real `zo-faqs` FAQ set about Zo Computer itself) — useful as a working
  example, safe to delete if you want to start from zero.
- `data/analytics.jsonl` is an empty example analytics log; harmless to keep or clear.
- No personal contact data or real user emails are present anywhere in this export — the OTP
  allowlist ships with a placeholder value only.
