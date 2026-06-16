#!/usr/bin/env node
/**
 * End-to-end WordPress integration test.
 *
 * Starts a mock WP REST API server on :9191, seeds the DB with a complete
 * campaign, runs the full publish flow via our Next.js API, and reports
 * pass/fail for every request our code makes.
 *
 * Usage:
 *   node scripts/test-wp.mjs                   # mock WP server (default)
 *   REAL_WP_URL=https://... \
 *   REAL_WP_USER=admin \
 *   REAL_WP_PASS="xxxx xxxx xxxx" \
 *   node scripts/test-wp.mjs --real            # real WP site
 */

import http from "node:http";
import { createClient } from "@libsql/client";
import { createCipheriv, randomBytes } from "node:crypto";

// ─── Config ──────────────────────────────────────────────────────────────────

const APP_URL       = "http://localhost:3000";
const MOCK_PORT     = 9191;
const MOCK_URL      = `http://localhost:${MOCK_PORT}`;
const DB_PATH       = new URL("../dev.db", import.meta.url).pathname;
const ENC_KEY       = "0000000000000000000000000000000000000000000000000000000000000001";
const USE_REAL      = process.argv.includes("--real");

const REAL_WP_URL   = process.env.REAL_WP_URL;
const REAL_WP_USER  = process.env.REAL_WP_USER;
const REAL_WP_PASS  = process.env.REAL_WP_PASS;

// ─── Colours ─────────────────────────────────────────────────────────────────

const c = {
  reset : "\x1b[0m",
  bold  : "\x1b[1m",
  green : "\x1b[32m",
  red   : "\x1b[31m",
  yellow: "\x1b[33m",
  cyan  : "\x1b[36m",
  gray  : "\x1b[90m",
};

const pass  = (s) => `${c.green}✓${c.reset} ${s}`;
const fail  = (s) => `${c.red}✗${c.reset} ${s}`;
const info  = (s) => `${c.cyan}→${c.reset} ${s}`;
const dim   = (s) => `${c.gray}${s}${c.reset}`;
const bold  = (s) => `${c.bold}${s}${c.reset}`;

let passed = 0, failed = 0;
const hits = {};   // track mock server calls

function assert(label, ok, detail = "") {
  if (ok) { console.log(pass(label)); passed++; }
  else     { console.log(fail(label) + (detail ? `  ${dim(detail)}` : "")); failed++; }
}

// ─── AES-256-GCM encrypt (mirrors lib/crypto.ts) ─────────────────────────────

function encrypt(plaintext) {
  const key = Buffer.from(ENC_KEY, "hex");
  const iv  = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc  = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag  = cipher.getAuthTag();
  return { encrypted: Buffer.concat([enc, tag]).toString("hex"), iv: iv.toString("hex") };
}

// ─── Mock WP REST API server ─────────────────────────────────────────────────

let mockServer;
let createdPageId   = 0;
let createdPostIds  = [];

function startMockServer() {
  return new Promise((resolve) => {
    mockServer = http.createServer((req, res) => {
      const url   = req.url;
      const method = req.method;
      hits[`${method} ${url}`] = (hits[`${method} ${url}`] || 0) + 1;

      let body = "";
      req.on("data", (chunk) => body += chunk);
      req.on("end", () => {
        res.setHeader("Content-Type", "application/json");

        // ── Auth check / users/me
        if (url === "/wp-json/wp/v2/users/me" && method === "GET") {
          const auth = req.headers["authorization"] || "";
          if (!auth.startsWith("Basic ")) {
            res.writeHead(401);
            return res.end(JSON.stringify({ message: "Not authenticated." }));
          }
          res.writeHead(200);
          return res.end(JSON.stringify({ id: 1, name: "admin" }));
        }

        // ── Root (site info)
        if (url === "/wp-json" && method === "GET") {
          res.writeHead(200);
          return res.end(JSON.stringify({ name: "Test WP Site (Mock)" }));
        }

        // ── Create page
        if (url === "/wp-json/wp/v2/pages" && method === "POST") {
          createdPageId = Math.floor(Math.random() * 9000) + 1000;
          res.writeHead(201);
          return res.end(JSON.stringify({
            id: createdPageId,
            link: `${MOCK_URL}/?page_id=${createdPageId}`,
            guid: { rendered: `${MOCK_URL}/?p=${createdPageId}` },
          }));
        }

        // ── ACF fields — page
        if (url.match(/^\/wp-json\/acf\/v3\/pages\/\d+$/) && method === "POST") {
          res.writeHead(200);
          return res.end(JSON.stringify({ message: "ACF updated" }));
        }

        // ── Update page (Yoast meta)
        if (url.match(/^\/wp-json\/wp\/v2\/pages\/\d+$/) && method === "POST") {
          res.writeHead(200);
          return res.end(JSON.stringify({ id: parseInt(url.split("/").pop()) }));
        }

        // ── Create post (article)
        if (url === "/wp-json/wp/v2/posts" && method === "POST") {
          const postId = Math.floor(Math.random() * 9000) + 1000;
          createdPostIds.push(postId);
          res.writeHead(201);
          return res.end(JSON.stringify({
            id: postId,
            link: `${MOCK_URL}/?p=${postId}`,
            guid: { rendered: `${MOCK_URL}/?p=${postId}` },
          }));
        }

        // ── ACF fields — post
        if (url.match(/^\/wp-json\/acf\/v3\/posts\/\d+$/) && method === "POST") {
          res.writeHead(200);
          return res.end(JSON.stringify({ message: "ACF updated" }));
        }

        // ── Update post (Yoast meta)
        if (url.match(/^\/wp-json\/wp\/v2\/posts\/\d+$/) && method === "POST") {
          res.writeHead(200);
          return res.end(JSON.stringify({ id: parseInt(url.split("/").pop()) }));
        }

        // ── 404 catch-all
        console.log(dim(`  [mock] unhandled: ${method} ${url}`));
        res.writeHead(404);
        res.end(JSON.stringify({ message: "Not found" }));
      });
    });

    mockServer.listen(MOCK_PORT, () => resolve());
  });
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

const db = createClient({ url: `file:${DB_PATH}` });

async function seedTestData(wpSiteId) {
  const profileId  = `test_profile_${Date.now()}`;
  const campaignId = `test_camp_${Date.now()}`;

  const page = JSON.stringify({
    heroIntro: "Austin homeowners trust us for fast, reliable plumbing. No generic pitch here — just licensed plumbers who show up on time.",
    bodySections: [
      { heading: "Same-Day Plumbing in Austin TX", content: "We dispatch within 2 hours for most Austin zip codes. Our trucks are stocked for burst pipes, water heater failures, and drain blockages — no second trip needed." },
      { heading: "Upfront Pricing, No Surprises", content: "Every job starts with a free on-site estimate. You approve the price before we turn a wrench. We've served 4,000+ Austin households since 2012." },
      { heading: "Licensed & Insured Texas Plumbers", content: "All our technicians hold active Texas M-11822 plumbing licenses. We carry $2M liability coverage. You can verify both before we enter your home." },
    ],
    faq: [
      { question: "How quickly can you get to me in Austin?", answer: "Most Austin zip codes get same-day service. We typically arrive within 2-4 hours of your call." },
      { question: "Do you give free estimates?", answer: "Yes. We provide written estimates before starting any work. No hidden fees." },
      { question: "Are you licensed in Texas?", answer: "Yes. We hold Texas plumbing license M-11822, verifiable on the TSBPE website." },
      { question: "What areas do you serve?", answer: "All Austin zip codes plus Round Rock, Cedar Park, and Pflugerville." },
      { question: "Do you work on weekends?", answer: "Yes, 7 days a week, 7am–7pm. Emergency calls available after hours for burst pipes." },
      { question: "What payment methods do you accept?", answer: "Cash, check, all major credit cards, and Zelle." },
      { question: "Is your work guaranteed?", answer: "All labor is guaranteed for 12 months. Parts carry manufacturer warranties." },
    ],
    cta: "Call Austin Plumbing Pros now for same-day service in Austin, TX — (512) 555-0100",
    metaTitle: "Austin Plumber | Same-Day Service | Austin Plumbing Pros",
    metaDescription: "Licensed Austin plumber with same-day availability. Upfront pricing. 4,000+ jobs since 2012. Call (512) 555-0100 for fast service.",
  });

  const articles = JSON.stringify([
    {
      topicId: "topic_1",
      title: "How Much Does a Plumber Cost in Austin TX?",
      intro: "Plumbing costs in Austin range widely depending on the job. Here's what you'll actually pay — with no marketing fluff.",
      sections: [
        { heading: "Average Austin Plumbing Rates", content: "Most Austin plumbers charge $85–$150/hour for labor. Simple fixes like replacing a faucet run $150–$250 total. Water heater replacements average $800–$1,400." },
        { heading: "What Drives Plumbing Costs Up", content: "After-hours calls add 25–50%. Old cast-iron pipes in East Austin homes cost more to work on. Permits for water heater replacements add $75–$125 but are legally required in Travis County." },
        { heading: "How to Get an Honest Price", content: "Always get a written estimate before work starts. Reputable Austin plumbers won't charge for estimates on standard jobs. Get two quotes for anything over $500." },
      ],
      faq: [
        { question: "What's the minimum charge for an Austin plumber?", answer: "Most Austin plumbers have a service call fee of $75–$100, which covers the diagnosis." },
        { question: "Is it cheaper to call during business hours?", answer: "Yes. After-hours and weekend rates are 25–50% higher with most Austin plumbers." },
        { question: "Do I need a permit for a water heater replacement in Austin?", answer: "Yes. Travis County requires a permit for water heater replacements. Your plumber should pull this for you." },
      ],
      conclusion: "Getting a written estimate upfront is the single best way to avoid plumbing bill surprises in Austin. Our team provides free, written estimates before any work begins.",
      internalLinkSuggestion: "Link 'Austin plumber' to the main service page using anchor text that matches the page's target query.",
      metaTitle: "How Much Does a Plumber Cost in Austin TX? (2026 Prices)",
      metaDescription: "Real Austin plumbing costs in 2026. Hourly rates, common job prices, and how to avoid being overcharged. From a licensed Austin plumber.",
    },
  ]);

  await db.execute({ sql: "INSERT INTO ServiceProfile (id, name, service, location, targetAudience, painPoints, usps, salesObjections, toneNotes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))", args: [profileId, "Test Profile", "Plumbing", "Austin TX", "Austin homeowners", '["burst pipes","slow drains","no hot water"]', '["same-day","licensed","upfront pricing"]', '["price","reliability","licensing"]', "Direct, no jargon"] });

  await db.execute({ sql: "INSERT INTO Campaign (id, serviceProfileId, state, approvedQueries, mainPageApproved, generatedArticles, wpSiteId, createdAt, updatedAt) VALUES (?, ?, 'OUTPUT_FORMATTED', ?, ?, ?, ?, datetime('now'), datetime('now'))", args: [campaignId, profileId, JSON.stringify([{ id: "q1", text: "plumber Austin TX", volumeTier: "High", intentType: "Transactional" }]), page, articles, wpSiteId] });

  return { profileId, campaignId };
}

async function cleanup(profileId, campaignId, wpSiteId) {
  await db.execute({ sql: "DELETE FROM Campaign WHERE id = ?", args: [campaignId] });
  await db.execute({ sql: "DELETE FROM ServiceProfile WHERE id = ?", args: [profileId] });
  await db.execute({ sql: "DELETE FROM WPSite WHERE id = ?", args: [wpSiteId] });
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiGet(path) {
  const res = await fetch(`${APP_URL}${path}`);
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
}

async function apiPost(path, data) {
  const res = await fetch(`${APP_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${bold("AI SEO Tool — WordPress Integration Test")}`);
  console.log(dim("─".repeat(52)));

  // ── Decide mode
  let wpUrl, wpUser, wpPass;
  if (USE_REAL) {
    if (!REAL_WP_URL || !REAL_WP_USER || !REAL_WP_PASS) {
      console.log(fail("--real flag requires REAL_WP_URL, REAL_WP_USER, REAL_WP_PASS env vars"));
      process.exit(1);
    }
    wpUrl  = REAL_WP_URL;
    wpUser = REAL_WP_USER;
    wpPass = REAL_WP_PASS;
    console.log(info(`Mode: real WP site → ${wpUrl}`));
  } else {
    console.log(info(`Mode: mock WP server on :${MOCK_PORT}`));
    await startMockServer();
    console.log(pass("Mock WP server started"));
    wpUrl  = MOCK_URL;
    wpUser = "admin";
    wpPass = "test test test test test test";
  }

  console.log("");
  console.log(bold("1 · App health check"));
  console.log(dim("─".repeat(52)));

  // Dev server check
  const health = await apiGet("/api/campaigns").catch(() => null);
  assert("Next.js dev server responding on :3000", !!health && health.ok);

  console.log("");
  console.log(bold("2 · WP connection test"));
  console.log(dim("─".repeat(52)));

  // Add WP site via API
  const siteRes = await apiPost("/api/sites", { name: "Test WP Site", url: wpUrl, username: wpUser, appPassword: wpPass });
  assert("POST /api/sites — site created", siteRes.ok, JSON.stringify(siteRes.body).slice(0, 120));
  const wpSiteId = siteRes.body?.id;
  assert("WP site has an ID", !!wpSiteId);

  if (!wpSiteId) { report(); return; }

  // Connection test
  const testRes = await apiPost(`/api/sites/${wpSiteId}/test`, {});
  assert("POST /api/sites/[id]/test — connection ok", testRes.ok && testRes.body?.ok, testRes.body?.error || "");
  if (testRes.body?.siteTitle) console.log(dim(`    Site title: "${testRes.body.siteTitle}"`));

  console.log("");
  console.log(bold("3 · Seed test campaign"));
  console.log(dim("─".repeat(52)));

  const { profileId, campaignId } = await seedTestData(wpSiteId);
  assert("Service profile + campaign seeded to DB", !!campaignId);
  console.log(dim(`    Campaign ID: ${campaignId}`));
  console.log(dim(`    State: OUTPUT_FORMATTED (1 page + 1 article)`));

  // Verify campaign is readable via API
  const campRes = await apiGet(`/api/campaigns/${campaignId}`);
  assert("GET /api/campaigns/[id] — campaign readable", campRes.ok && campRes.body?.state === "OUTPUT_FORMATTED");

  console.log("");
  console.log(bold("4 · Publish to WordPress"));
  console.log(dim("─".repeat(52)));

  const publishRes = await apiPost(`/api/campaigns/${campaignId}/publish`, { wpSiteId });
  assert("POST /api/campaigns/[id]/publish — 200 OK", publishRes.ok, !publishRes.ok ? JSON.stringify(publishRes.body).slice(0, 200) : "");

  const result = publishRes.body;
  assert("Service page created in WP",  !!result?.page?.id,      `page id: ${result?.page?.id}`);
  assert("Service page has edit URL",   !!result?.page?.editUrl, result?.page?.editUrl || "");
  assert("Articles array returned",     Array.isArray(result?.articles));
  assert("Article created in WP",       result?.articles?.length > 0, `${result?.articles?.length} articles`);

  if (result?.articles?.[0]) {
    assert("Article has edit URL", !!result.articles[0].editUrl, result.articles[0].editUrl || "");
  }

  // Verify state advanced to COMPLETE
  const finalCamp = await apiGet(`/api/campaigns/${campaignId}`);
  assert("Campaign state advanced to COMPLETE", finalCamp.body?.state === "COMPLETE", `got: ${finalCamp.body?.state}`);
  assert("wpPageDraftId saved",               !!finalCamp.body?.wpPageDraftId);

  if (!USE_REAL) {
    console.log("");
    console.log(bold("5 · WP request audit"));
    console.log(dim("─".repeat(52)));
    const expected = [
      ["GET /wp-json/wp/v2/users/me",          "Auth check"],
      ["GET /wp-json",                          "Site title fetch"],
      ["POST /wp-json/wp/v2/pages",             "Create service page draft"],
      ["POST /wp-json/wp/v2/posts",             "Create article draft"],
    ];
    for (const [key, label] of expected) {
      assert(`${label}  ${dim(key)}`, (hits[key] || 0) > 0, `not called`);
    }
    // ACF hits (dynamic IDs — check by prefix)
    const acfPageHit  = Object.keys(hits).some((k) => k.match(/POST \/wp-json\/acf\/v3\/pages\/\d+/));
    const acfPostHit  = Object.keys(hits).some((k) => k.match(/POST \/wp-json\/acf\/v3\/posts\/\d+/));
    const yoastPageHit = Object.keys(hits).some((k) => k.match(/POST \/wp-json\/wp\/v2\/pages\/\d+/));
    const yoastPostHit = Object.keys(hits).some((k) => k.match(/POST \/wp-json\/wp\/v2\/posts\/\d+/));
    assert(`Write page ACF fields  ${dim("POST /wp-json/acf/v3/pages/{id}")}`,   acfPageHit);
    assert(`Write article ACF fields  ${dim("POST /wp-json/acf/v3/posts/{id}")}`, acfPostHit);
    assert(`Write page Yoast meta  ${dim("POST /wp-json/wp/v2/pages/{id}")}`,    yoastPageHit);
    assert(`Write article Yoast meta  ${dim("POST /wp-json/wp/v2/posts/{id}")}`, yoastPostHit);
  }

  if (USE_REAL && result?.page?.editUrl) {
    console.log("");
    console.log(bold("5 · WordPress links"));
    console.log(dim("─".repeat(52)));
    console.log(`  Service page: ${result.page.editUrl}`);
    result.articles?.forEach((a) => console.log(`  ${a.title}: ${a.editUrl}`));
  }

  // ── Cleanup
  console.log("");
  console.log(bold("6 · Cleanup"));
  console.log(dim("─".repeat(52)));
  await cleanup(profileId, campaignId, wpSiteId);
  assert("Test data removed from DB", true);

  report();
}

function report() {
  const total = passed + failed;
  console.log("");
  console.log(dim("═".repeat(52)));
  if (failed === 0) {
    console.log(`${c.green}${c.bold}  All ${total} checks passed${c.reset}`);
  } else {
    console.log(`  ${c.green}${c.bold}${passed} passed${c.reset}  ${c.red}${c.bold}${failed} failed${c.reset}  of ${total}`);
  }
  console.log(dim("═".repeat(52)));
  console.log("");
  if (mockServer) mockServer.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(fail("Unexpected error: " + err.message));
  console.error(err.stack);
  if (mockServer) mockServer.close();
  process.exit(1);
});
