---
created: 2026-09-08
last_edited: 2026-09-08
version: 1.0
provenance: con_XCsPl93lMboybzeI
---

# Implementing the Climate Market Map on a new Zo account

> **Quick path:** `ZO-START.md` at the repo root covers setup in a few terminal commands.
> This file is the detailed reference.

A market-intelligence dashboard built on a PitchBook export of 2,674 European climate tech
companies across 7 sectors — sector-level charts plus a searchable, sortable company table.

## What's in this folder

The full site source plus `data/companies.json` (1.4MB — the actual dataset the live dashboard
serves) and `docs/shadcncharts.md` (chart-library reference notes used while building it).

**Deliberately not included:** the raw PitchBook source exports (`Pitchbook Sheets/*.xlsx`,
`pitchbook_api_data.json`) that `companies.json` was derived from. Those are licensed PitchBook
data that included personal contact fields (name, email, title) before redaction — only the
already-redacted, company-level dataset in `data/companies.json` is safe to redistribute. See
`data/companies.json`'s structure below if you need to regenerate or extend it from a new export.

## Steps

1. **Create a new Zo Site** (blank variant).
2. **Copy everything in this folder** (including `data/companies.json`) into the new site
   directory.
3. **Check `zosite.json` ports** for conflicts; change if needed.
4. `bun install` (uses the included `bun.lock`).
5. `bun run build` to confirm it builds (don't run `bun run dev` — it never exits; Zo runs the
   site itself). The dashboard reads `data/companies.json` directly, no database or external API
   calls needed at runtime, so it should work immediately.
6. Publish when ready.

## `data/companies.json` structure

```json
{
  "totalCompanies": 2674,
  "totalRaised": 13197.48,
  "sectors": [ /* 7 sector summary objects */ ],
  "companies": [
    {
      "id": "...", "name": "...", "sector": "...", "state": "...", "city": "...",
      "country": "...", "website": "...", "totalRaised": 0, "lastFinancing": 0,
      "employees": 0, "description": "..."
    }
  ]
}
```

No `name`/`email`/`title` fields for individual people — only company-level data. If you refresh
this from a new PitchBook export, strip any personal contact columns before writing a new
`companies.json`, the same way the original was redacted.
