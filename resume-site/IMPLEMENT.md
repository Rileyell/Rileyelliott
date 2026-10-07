---
created: 2026-09-08
last_edited: 2026-09-08
version: 1.0
provenance: con_XCsPl93lMboybzeI
---

# Implementing the resume homepage on a new Zo account

> **Quick path:** `ZO-START.md` at the repo root covers setup in a few terminal commands.
> This file is the detailed reference.

This is the source for the `/` (homepage) route on `rileye.zo.space` (originally
`rileyell.zo.space`). It's a zo.space
**page route**, not a standalone app — there's no build step, no dependencies to install, and
no service to publish. You're recreating one React component inside the new owner's Zo Space.

## Steps

1. Sign in to the new Zo account (the one taking ownership).
2. Ask Zo (in chat) to upload `images/riley-headshot.jpg` from this folder as a Space asset at
   `/images/riley-headshot.jpg` (or use the `update_space_asset` tool directly:
   `source_file=images/riley-headshot.jpg`, `asset_path=/images/riley-headshot.jpg`).
3. Ask Zo to create/replace the `/` page route on the new zo.space using the exact contents of
   `home.tsx` in this folder. In tool terms this is `write_space_route(path="/", route_type="page",
   code=<contents of home.tsx>, public=true)`.
4. The project links inside `home.tsx` (`PROJECTS[].links[].href`) already point at
   `*-rileye.zocomputer.io`. After each project is published, confirm its URL matches — the
   prefix comes from each site's publish label (`draft-app`, `faq-dashboard`,
   `climate-market-map`, `data-designer`), so a different label means a different URL.
5. Update the contact block (email, phone, LinkedIn) if the new owner wants their own info instead
   of Riley's — this page is written in first person as Riley Elliott's resume.
6. Publish: the homepage defaults to public on zo.space, so no extra publish step is needed beyond
   saving the route.

## Notes

- The page relies on two shared zo.space kit components: `@/components/ui/badge`,
  `@/components/ui/card`, `@/components/kit/arrow-link`, `@/components/kit/tooltip`. These ship
  with every zo.space Space by default — no install needed. If the new Space predates the site kit
  (`/__substrate/space/src/components/kit/` doesn't exist), swap `ArrowLink`/`Tooltip` for plain
  `<a>` tags.
- All copy is genericized/first-person as originally published — edit before reuse if the new
  owner isn't presenting this as their own resume.
