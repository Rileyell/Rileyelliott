---
created: 2026-09-08
last_edited: 2026-09-08
version: 1.0
provenance: con_XCsPl93lMboybzeI
---

# Handoff notes

This repo exists because Riley is losing access to the Zo account these projects were built on
(`rileyell.zo.computer` / `rileyell.zo.space`) and wants to keep working on them from a different
Zo account.

## The honest limitation: there is no "transfer ownership" button

Zo Computer does not have a feature to transfer a zo.space route, a published Zo Site, or a
user service from one account to another. Everything published under `rileyell.zo.computer` —
the homepage, the four `*-rileyell.zocomputer.io` sites, and the underlying Zo Site projects —
stays tied to that account. Losing access to it means losing the ability to edit those live
things directly, full stop.

What *is* portable is the source code and context, which is what this repo captures. The
realistic migration path is:

1. This repo becomes the new source of truth.
2. On the new Zo account, each project folder gets turned back into a live Zo Site by following
   its `IMPLEMENT.md` (create the Site, drop in the source, install, publish).
3. The resume homepage gets recreated as `/` on the new account's zo.space, with its four project
   links updated to point at the new account's freshly published URLs (see
   `resume-site/IMPLEMENT.md`).

This is a rebuild from portable source, not a literal transfer — the old URLs
(`*-rileyell.zocomputer.io`, `rileyell.zo.space`) will keep pointing at the old account (or go
dark if that account is closed) regardless of what happens here.

## Suggested order of operations on the new account

1. `fantasy-draft-helper/` — most self-contained, has its own prior deploy guide to follow.
2. `faq-dashboard/` — needs its bundled Skills installed first (see its `IMPLEMENT.md`).
3. `climate-market-map/` — static-ish dataset, low risk.
4. `data-designer/` — persona + benchmark content, no runtime dependencies beyond the site itself.
5. `resume-site/` — do this last, once you have live URLs for the four projects above to link to.

## What to double-check after migrating

- Every project reads `ZO_CLIENT_IDENTITY_TOKEN` from the environment for any Zo API calls
  (`backend-lib/zo-api.ts` in each). This is provided automatically by the Zo Computer runtime —
  nothing to configure, but don't hardcode a token from the old account into the new one.
- FAQ Dashboard's OTP email verification and any Google Sheets / Gmail integrations will need to
  be re-authorized under the new account (OAuth connections don't transfer either).
- Re-check `climate-market-map/data/companies.json` before re-publishing if you refresh it from a
  new PitchBook export — strip personal contact fields (name/email/title) before making it public
  again, the same way the original was redacted.
