#!/usr/bin/env bash
# install-site.sh — copy one project from this repo into a Zo Site and build it.
#
#   bash scripts/install-site.sh <project> [site-dir]
#
# <project> is one of: climate-market-map, data-designer, fantasy-draft-helper, faq-dashboard
# [site-dir] defaults to /home/workspace/<site-name> (the folder Zo creates for a new Site).
#
# Needs no AI and no credits. It never starts a server — Zo runs the site itself,
# and a dev server would never exit.

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${1:-}"

case "$PROJECT" in
  climate-market-map|data-designer|faq-dashboard) SITE_NAME="$PROJECT" ;;
  fantasy-draft-helper) SITE_NAME="draft-app" ;;
  *)
    echo "Usage: bash scripts/install-site.sh <project> [site-dir]"
    echo "Projects: climate-market-map, data-designer, fantasy-draft-helper, faq-dashboard"
    exit 1
    ;;
esac

SRC="$REPO/$PROJECT"
DEST="${2:-/home/workspace/$SITE_NAME}"

if ! command -v bun >/dev/null 2>&1; then
  echo "❌ bun is not installed. Install it with:  curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

# The Site has to exist first: Zo assigns its ports and publish URL in zosite.json,
# and those can't be made up from here.
if [[ ! -f "$DEST/zosite.json" ]]; then
  echo "❌ No Zo Site found at $DEST"
  echo ""
  echo "   Create it first. Send Zo this exact message (works on the cheapest model):"
  echo ""
  echo "     Create a new blank site named $SITE_NAME. Do nothing else."
  echo ""
  echo "   Then run this script again."
  exit 1
fi

echo "📦 Installing $PROJECT into $DEST"

# Keep Zo's zosite.json; copy everything else over the blank template.
cp "$DEST/zosite.json" /tmp/zosite.json.keep
tar -C "$SRC" \
  --exclude=node_modules --exclude=dist --exclude=IMPLEMENT.md --exclude=skills \
  --exclude=zosite.json \
  -cf - . | tar -C "$DEST" -xf -
mv /tmp/zosite.json.keep "$DEST/zosite.json"

# The FAQ dashboard's scraper/chatbot live in the account-wide Skills folder.
if [[ "$PROJECT" == "faq-dashboard" ]]; then
  mkdir -p /home/workspace/Skills
  cp -R "$SRC/skills/." /home/workspace/Skills/
  echo "   ✅ Skills copied to /home/workspace/Skills"
fi

cd "$DEST"
echo "📥 bun install"
bun install
echo "🔨 bun run build"
bun run build

echo ""
echo "✅ $PROJECT is installed and builds cleanly."
echo "   Next: open the Sites page in Zo and click Publish on \"$SITE_NAME\"."
echo "   Its public URL should be https://$SITE_NAME-<your-handle>.zocomputer.io"
