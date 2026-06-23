#!/bin/bash
# Starts the wildent Local site (via Local.app) + ngrok tunnel,
# then updates the AI SEO Tool DB with the new public URL.

set -e

SITE_PORT=10008
DB="$HOME/Developer/ai-seo-tool/dev.db"
WPSITE_ID="cmqlsj2kg0001w3s4lb6wdmxg"
NGROK_API="http://localhost:4040/api/tunnels"

# ── 1. Open Local.app and start the site ────────────────────────────────────
echo "→ Opening Local.app..."
open -a Local

echo "→ Waiting for wildent site to start on port $SITE_PORT..."
echo "  (Start the 'wildent' site in Local if it isn't already green)"

# Poll until nginx on port 10008 responds (up to 120s)
for i in $(seq 1 60); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$SITE_PORT/ 2>/dev/null || true)
  if [[ "$STATUS" != "000" ]]; then
    echo "  ✓ Site is up (HTTP $STATUS)"
    break
  fi
  if [[ $i -eq 60 ]]; then
    echo "  ✗ Timed out waiting for site. Start 'wildent' in Local.app and re-run."
    exit 1
  fi
  sleep 2
done

# ── 2. Kill any stale ngrok process ─────────────────────────────────────────
pkill -f "ngrok http" 2>/dev/null || true
sleep 1

# ── 3. Start ngrok ──────────────────────────────────────────────────────────
echo "→ Starting ngrok tunnel on port $SITE_PORT..."
ngrok http $SITE_PORT --log=stdout > /tmp/ngrok-wildent.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok API to become available
for i in $(seq 1 15); do
  NGROK_URL=$(curl -s $NGROK_API 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tunnels = data.get('tunnels', [])
    for t in tunnels:
        if t.get('proto') == 'https':
            print(t['public_url'])
            break
except:
    pass
" 2>/dev/null)
  if [[ -n "$NGROK_URL" ]]; then
    echo "  ✓ ngrok URL: $NGROK_URL"
    break
  fi
  if [[ $i -eq 15 ]]; then
    echo "  ✗ ngrok failed to start. Check /tmp/ngrok-wildent.log"
    exit 1
  fi
  sleep 1
done

# ── 4. Update AI SEO Tool DB ─────────────────────────────────────────────────
echo "→ Updating WPSite URL in AI SEO Tool database..."
sqlite3 "$DB" "UPDATE WPSite SET url='$NGROK_URL', updatedAt=datetime('now') WHERE id='$WPSITE_ID';"

STORED=$(sqlite3 "$DB" "SELECT url FROM WPSite WHERE id='$WPSITE_ID';")
echo "  ✓ Stored URL: $STORED"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  WordPress:  http://localhost:$SITE_PORT/wp-admin"
echo "  Public URL: $NGROK_URL"
echo "  AI SEO:     https://ai-seo-tool-liard.vercel.app"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Ready. Go to ai-seo-tool-liard.vercel.app and publish your campaign."
