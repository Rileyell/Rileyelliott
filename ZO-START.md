# Putting these sites on a new Zo account (no AI credits needed)

Do almost everything in the Zo **terminal**. Use Zo chat only for the two short messages
below — they're single actions, so even the cheapest model handles them.

**Agents: do not read the other READMEs, and never run `bun run dev` or `bun run prod` —
they start a server that never exits.**

## 1. Get the code (terminal, once)

```bash
cd /home/workspace && git clone https://github.com/Rileyell/Rileyelliott.git
```

## 2. For each site

| Project | Site name to create |
|---|---|
| `climate-market-map` | `climate-market-map` |
| `data-designer` | `data-designer` |
| `fantasy-draft-helper` | `draft-app` |
| `faq-dashboard` | `faq-dashboard` |

1. **Zo chat:** `Create a new blank site named <site name>. Do nothing else.`
2. **Terminal:**
   ```bash
   bash /home/workspace/Rileyelliott/scripts/install-site.sh <project>
   ```
3. **Zo Sites page:** click **Publish** on that site.

## 3. Resume homepage (last)

**Zo chat:**
> Upload /home/workspace/Rileyelliott/resume-site/images/riley-headshot.jpg as the space asset
> /images/riley-headshot.jpg, then create a public page route at / in my zo.space with the exact
> contents of /home/workspace/Rileyelliott/resume-site/home.tsx. Do nothing else.

The links in `home.tsx` assume each site is published as `<site name>-rileye.zocomputer.io`.

## What works without AI credits

- **Climate Market Map, Data Designer, resume homepage:** everything.
- **Fantasy Draft Helper:** everything except the AI chat advisor. Reports fall back to plain text.
- **FAQ Dashboard:** viewing and hand-editing FAQs. Scraping a site into FAQs and the chatbot need
  AI (`FAQ_EXTRACT_MODEL` and `MINIMAX_API_KEY` — see `faq-dashboard/IMPLEMENT.md`).
