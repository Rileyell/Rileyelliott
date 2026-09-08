"""
faq_extract.py — Generic FAQ generator from any website.

Scrapes any URL and uses AI to generate FAQ entries with auto-detected
categories and audiences based on the actual content found.

Usage:
    python3 faq_extract.py <url> --slug <slug> --program "<name>" [options]

Options:
    --slug            Event/topic slug (used for output file naming)
    --program         Topic/program name (written into FAQ entries)
    --data-file       Path to faq_data.json to append drafts to (required)
    --auto-categories Auto-detect categories from content (default: on)
    --milestones      Override comma-separated categories (skips auto-detect)
    --audiences       Override comma-separated audience types (skips auto-detect)
    --depth           Crawl depth (default: 2)
    --max-pages       Max pages to crawl (default: 20)
    --dry-run         Print what would be written without writing files
"""

import argparse
import json
import os
import sys
import uuid
import re
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [faq_extract] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("faq_extract")

WORKSPACE = Path("/home/workspace")

ZO_ASK_MODEL = os.environ.get("FAQ_EXTRACT_MODEL", "byok:c765355c-e6c6-4c06-97de-993a238d0f1c")

GENERIC_EXTRACTION_PROMPT = """
You are extracting FAQ-relevant information from this website.

Read the scraped content carefully and return a JSON object with:

{
  "site_name": "Name of the site or organization",
  "site_description": "One-sentence description of what this site/organization does",
  "categories": ["category1", "category2", ...],
  "audiences": ["audience1", "audience2", ...],
  "faqs": [
    {
      "question": "Question text",
      "answer": "Answer text",
      "category": "which category above this belongs to",
      "audience": "which audience above this is most relevant for"
    }
  ]
}

Rules:
- categories: 4–8 topic buckets that naturally organize the questions found (e.g. "Getting Started", "Pricing", "Features", "Account", "Technical", "Policies"). Derive from what's actually on the page — do not use generic placeholders.
- audiences: 2–4 distinct user types implied by the content (e.g. "New Users", "Admins", "Developers", "Enterprise"). Derive from context — not generic placeholders.
- faqs: Extract EVERY question/answer pair found on the page. Also generate obvious questions that the content answers even if not formatted as Q&A. Aim for at least 10 entries.
- If a field truly can't be determined from the content, use null (not a placeholder string).

Return ONLY valid JSON. No markdown fences, no explanation.
"""


def _zo_ask(prompt: str, token: str) -> str:
    import requests
    resp = requests.post(
        "https://api.zo.computer/zo/ask",
        headers={"authorization": token, "content-type": "application/json"},
        json={"input": prompt, "model_name": ZO_ASK_MODEL},
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json().get("output", "")


def _scrape_via_zo_browser(url: str, token: str) -> str:
    prompt = (
        f"Use read_webpage to fetch this URL and return ALL visible text content from the page. "
        f"Include every section you can find. URL: {url}\n\n"
        f"Return only the raw page text — no formatting commentary."
    )
    try:
        content = _zo_ask(prompt, token)
        log.info(f"Browser fallback fetched {len(content)} chars")
        return content
    except Exception as e:
        log.error(f"Browser fallback failed: {e}")
        return ""


def run_scraper(url: str, depth: int = 2, max_pages: int = 20, token: str = "") -> str:
    import subprocess
    scraper_path = Path(__file__).parent / "scraper.py"
    if not scraper_path.exists():
        log.error(f"Base scraper not found at {scraper_path}")
        sys.exit(1)

    log.info(f"Crawling {url} (depth={depth}, max_pages={max_pages})")
    cmd = [sys.executable, str(scraper_path), "crawl", url, "--depth", str(depth), "--max-pages", str(max_pages)]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        content = result.stdout
    except subprocess.TimeoutExpired:
        log.error("Scraper timed out after 300s")
        sys.exit(1)
    except Exception as e:
        log.error(f"Scraper failed: {e}")
        sys.exit(1)

    if len(content.strip()) < 100:
        log.warning(f"Scraper returned {len(content.strip())} chars — trying Zo browser fallback...")
        if token:
            content = _scrape_via_zo_browser(url, token)
        else:
            log.warning("No ZO_CLIENT_IDENTITY_TOKEN — cannot use browser fallback")

    return content


def extract_faq_structure(raw_content: str, program: str, token: str) -> dict[str, Any]:
    if not token:
        log.warning("ZO_CLIENT_IDENTITY_TOKEN not set — cannot extract FAQs")
        return {"site_name": program, "categories": ["General"], "audiences": ["General"], "faqs": [], "site_description": None}

    prompt = f"{GENERIC_EXTRACTION_PROMPT}\n\nTopic/Program name (for context): {program}\n\n--- SCRAPED CONTENT ---\n{raw_content[:40000]}\n--- END CONTENT ---\n\nReturn ONLY valid JSON."

    try:
        log.info("Sending to Zo AI for FAQ extraction...")
        output = _zo_ask(prompt, token)

        cleaned = output.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```[a-z]*\n?", "", cleaned)
            cleaned = re.sub(r"\n?```$", "", cleaned)

        data = json.loads(cleaned)
        cats = data.get("categories", [])
        auds = data.get("audiences", [])
        log.info(f"Extracted {len(data.get('faqs', []))} FAQs, {len(cats)} categories, {len(auds)} audiences")
        return data

    except json.JSONDecodeError as e:
        log.error(f"JSON parse failed: {e}")
        return {"site_name": program, "categories": ["General"], "audiences": ["General"], "faqs": []}
    except Exception as e:
        log.error(f"AI extraction failed: {e}")
        return {"site_name": program, "categories": ["General"], "audiences": ["General"], "faqs": []}


def build_faq_entries(extracted: dict[str, Any], program: str) -> list[dict[str, Any]]:
    categories = extracted.get("categories") or ["General"]
    audiences = extracted.get("audiences") or ["General"]
    entries: list[dict[str, Any]] = []
    now = datetime.utcnow().isoformat()

    for faq in extracted.get("faqs", []):
        q = faq.get("question", "").strip()
        a = faq.get("answer", "").strip()
        if not q:
            continue

        # Category: use extracted value if it matches one of our categories, else first
        cat = faq.get("category", "")
        if cat not in categories:
            cat = categories[0] if categories else "General"

        # Audience: use extracted value if it matches, else first
        aud = faq.get("audience", "")
        if aud not in audiences:
            aud = audiences[0] if audiences else "General"

        entries.append({
            "id": str(uuid.uuid4()),
            "program": program,
            "question": q,
            "answer": a,
            "milestone": cat,
            "audience": aud,
            "status": "draft",
            "source": "ai-generated",
            "created_at": now,
            "updated_at": now,
        })

    log.info(f"Built {len(entries)} draft FAQ entries")
    return entries


def update_registry_categories(slug: str, extracted: dict[str, Any]) -> None:
    """Push auto-detected categories + audiences back into the event registry."""
    registry_path = WORKSPACE / "faq-dashboard" / "data" / "faq-events.json"
    if not registry_path.exists():
        return
    try:
        registry = json.loads(registry_path.read_text())
        for event in registry:
            if event["slug"] == slug:
                cats = extracted.get("categories") or []
                auds = extracted.get("audiences") or []
                if cats:
                    event["milestones"] = cats
                if auds:
                    event["audiences"] = auds
                break
        registry_path.write_text(json.dumps(registry, indent=2))
        log.info(f"Updated registry categories for '{slug}'")
    except Exception as e:
        log.warning(f"Could not update registry: {e}")


def write_draft_faqs(entries: list[dict[str, Any]], data_file: Path, dry_run: bool = False) -> int:
    if not entries:
        log.info("No draft FAQ entries to write")
        return 0

    if dry_run:
        log.info(f"[DRY RUN] Would append {len(entries)} draft entries to {data_file}")
        for e in entries[:3]:
            log.info(f"  Sample: {e['question'][:80]}")
        return len(entries)

    existing: list[dict] = []
    if data_file.exists():
        try:
            existing = json.loads(data_file.read_text())
        except Exception:
            existing = []

    existing.extend(entries)
    data_file.parent.mkdir(parents=True, exist_ok=True)
    data_file.write_text(json.dumps(existing, indent=2))
    log.info(f"Appended {len(entries)} draft entries to {data_file}")
    return len(entries)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generic FAQ generator from any website")
    parser.add_argument("url", help="URL to scrape")
    parser.add_argument("--slug", required=True, help="Event/topic slug")
    parser.add_argument("--program", required=True, help="Program/topic name")
    parser.add_argument("--data-file", default="", help="Path to faq_data.json")
    parser.add_argument("--auto-categories", action="store_true", help="Auto-detect categories (default behavior)")
    parser.add_argument("--milestones", default="", help="Override categories (comma-separated)")
    parser.add_argument("--audiences", default="", help="Override audiences (comma-separated)")
    parser.add_argument("--depth", type=int, default=2, help="Crawl depth")
    parser.add_argument("--max-pages", type=int, default=20, help="Max pages to crawl")
    parser.add_argument("--dry-run", action="store_true", help="Print without writing")
    args = parser.parse_args()

    token = os.environ.get("ZO_CLIENT_IDENTITY_TOKEN", "")
    if not token:
        log.warning("No ZO_CLIENT_IDENTITY_TOKEN — AI extraction will be skipped")

    log.info(f"Starting FAQ extraction for: {args.program}")
    log.info(f"  URL: {args.url}")
    log.info(f"  Slug: {args.slug}")

    raw_content = run_scraper(args.url, depth=args.depth, max_pages=args.max_pages, token=token)
    if not raw_content.strip():
        log.error("Scraper returned empty content")
        sys.exit(1)
    log.info(f"Scraped {len(raw_content)} chars")

    extracted = extract_faq_structure(raw_content, args.program, token)

    # If caller passed explicit overrides, use them instead of auto-detected
    if args.milestones:
        extracted["categories"] = [m.strip() for m in args.milestones.split(",") if m.strip()]
    if args.audiences:
        extracted["audiences"] = [a.strip() for a in args.audiences.split(",") if a.strip()]

    # Push auto-detected categories back to registry
    if not args.dry_run:
        update_registry_categories(args.slug, extracted)

    entries = build_faq_entries(extracted, args.program)

    data_file = Path(args.data_file) if args.data_file else WORKSPACE / "faq-dashboard" / "data" / args.slug / "faq_data.json"
    count = write_draft_faqs(entries, data_file, dry_run=args.dry_run)

    summary = {
        "slug": args.slug,
        "url": args.url,
        "categories": extracted.get("categories", []),
        "audiences": extracted.get("audiences", []),
        "faqs_extracted": len(extracted.get("faqs", [])),
        "draft_entries_written": count,
        "data_file": str(data_file),
    }
    log.info(f"Done: {json.dumps(summary)}")
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
