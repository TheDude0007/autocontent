# AI SEO Tool — Project Analysis

**Prepared for:** Steve  
**Date:** June 17, 2026  
**Status:** Fully built and end-to-end verified locally

---

## What It Is

A private, internal web app that uses Claude AI (Anthropic) to generate SEO-optimized service pages and article clusters for WordPress client sites. Every step has a human review gate — nothing publishes without approval. The pilot use case is a Las Vegas web design company, but the profile/template system makes it reusable for any local service business.

**The core problem it solves:** Manually writing a service page plus 5–8 supporting articles for a local service client takes 8–15 hours. This tool generates a full content package in under 30 minutes of human time, with the AI handling the drafting and the operator handling the editing and approval.

---

## The 5-Step Pipeline

```
[Service Profile] → [Queries] → [Service Page] → [Topics] → [Articles] → [Publish to WP]
```

### Step 1 — Query Research
The operator creates a **Service Profile** once per client service (service type, location, target audience, pain points, USPs, sales objections, tone notes). From that profile, Claude generates **25 search queries** the real customers use — ranked by volume tier (High/Medium/Low) and intent type (Transactional/Informational/Navigational). The operator can reorder, remove irrelevant ones, and then approves the list.

### Step 2 — Service Page
Using the approved queries as the brief, Claude drafts a full service page:
- Hero intro paragraph
- 3 body sections with H2 headings
- 7 FAQ items drawn from the real sales objections
- Call to action paragraph
- Meta title (60 char limit) and meta description (155 char limit)

All fields are editable in-browser before approval.

### Step 3 — Article Topics
Claude proposes 8 article topics targeting the long-tail and informational queries from Step 1 — the kind of content that builds topical authority and captures "how much does X cost" traffic. Each topic gets a value rating (High/Medium). The operator selects which ones to produce.

### Step 4 — Articles
Claude writes each selected article in full:
- Intro, 3 body sections, 3 FAQ items, conclusion
- Internal link suggestion back to the service page
- Meta title and meta description

All articles are editable before approval.

### Step 5 — Publish to WordPress
One click pushes all content as **drafts** to the configured WordPress site via WP REST API + ACF Pro:
- Service page → WordPress Page (draft)
- Articles → WordPress Posts (drafts)
- ACF fields populated with structured content blocks
- Yoast SEO meta fields written automatically

An **Export JSON** fallback is available if no WP site is configured yet.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| UI | Tailwind CSS + shadcn/ui |
| Database | SQLite via Prisma ORM |
| AI | Anthropic claude-sonnet-4-6 (streaming SSE) |
| WP Integration | WP REST API v2 + ACF REST API + Yoast meta |
| Auth | WP Application Passwords (encrypted AES-256-GCM in SQLite) |
| Deployment target | Vercel (frontend + API routes) |

**Why SQLite:** This is a single-operator internal tool. SQLite is zero-ops and runs fine on a single machine or a Vercel-adjacent persistent store (Turso). No database server to manage.

**Why streaming:** Claude generates ~2,000–4,000 tokens for a service page. Streaming means the operator sees output flowing in real time rather than staring at a spinner for 2–3 minutes.

---

## Current State

The app is **fully implemented and end-to-end verified** as of June 17, 2026.

Every pipeline step has been exercised against the real Claude API:

- Profile created: *LV Web Design Co - Web Design* (Las Vegas, NV)
- Queries generated: 25 queries (High/Medium/Low; Transactional/Informational/Navigational)
- Service page generated: hero + 3 sections + 7 FAQs + CTA + meta
- Topics generated: 8 article topics, all relevant to Las Vegas web design
- Articles generated (3 selected): full-length with sections, FAQs, internal link suggestions, meta
- Publish page: content manifest displayed, WP push correctly blocked without site configured, Export JSON download confirmed working

Example generated content quality (from the E2E run):

> **Meta title:** "Web Design Company Las Vegas NV | 2-Week Turnaround"  
> **Article 1:** "How Much Does a Website Cost for a Small Business in Las Vegas?"  
> **Article 2:** "How Long Does It Take to Build a Business Website in Las Vegas?"  
> **Article 3:** "Why Your Las Vegas Business Website Isn't Showing Up on Google (And How to Fix It)"

---

## File Structure

```
ai-seo-tool/
├── app/
│   ├── page.tsx                    # Dashboard — campaign list
│   ├── profiles/                   # Service Profile CRUD
│   ├── templates/                  # ACF template mapping
│   ├── settings/                   # WordPress site credentials
│   └── campaigns/
│       ├── new/                    # Profile selector → create campaign
│       └── [id]/
│           ├── queries/            # Step 1 — generate + approve queries
│           ├── page/               # Step 2 — generate + approve service page
│           ├── topics/             # Step 3 — generate + select topics
│           ├── articles/           # Step 4 — generate + approve articles
│           └── publish/            # Step 5 — push to WP or export JSON
├── lib/
│   ├── ai/
│   │   ├── stream.ts               # SSE streaming wrapper for Claude API
│   │   └── prompts/                # Prompts for queries, page, topics, articles
│   ├── wordpress.ts                # WP REST API + ACF + Yoast integration
│   ├── crypto.ts                   # AES-256-GCM for WP credential storage
│   ├── campaign-routing.ts         # State machine → route mapping
│   └── db.ts                       # Prisma singleton
├── prisma/
│   └── schema.prisma               # ServiceProfile, Campaign, Template, WPSite
└── docs/
    ├── prd.md
    ├── architecture.md
    └── epic-1-scaffold-and-profiles.md
```

---

## How to Run Locally

**Prerequisites:** Node.js 18+, an Anthropic API key.

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local
ANTHROPIC_API_KEY=sk-ant-...
ENCRYPTION_KEY=<any 32-byte hex string>
DATABASE_URL=file:./dev.db

# 3. Initialize database
npx prisma migrate dev

# 4. Start dev server
npm run dev
# → http://localhost:3000
```

---

## What's Left for Production

**1. Persistent database for Vercel deployment**

SQLite is local-only. For Vercel, swap `DATABASE_URL` to a [Turso](https://turso.tech) database (libSQL-compatible with Prisma) — takes about 30 minutes. Cost: ~$0/month at this usage scale.

**2. Live WordPress push test**

The WP REST API integration is implemented but hasn't been tested against a live site yet. Steps:
- Install ACF Pro on the target WP site
- Enable ACF REST API (ACF Pro setting)
- Create a WordPress Application Password for the publishing user
- Add the site in the app's Settings page
- Run a campaign through to the Publish step and click "Push 4 drafts to WordPress"

**3. Vercel environment variables**

Set these in the Vercel dashboard before deploying:
```
ANTHROPIC_API_KEY
ENCRYPTION_KEY
DATABASE_URL   ← Turso connection string
```

**4. Template mapping (optional)**

The Templates page lets you map content blocks (hero intro, body sections, FAQ, etc.) to specific ACF field names on the WP site. If no template is selected at publish time, the app uses default field names. This is optional but useful if the WP site has a custom Divi/ACF setup.

---

## Cost Profile

All AI calls are pay-per-token via the Anthropic API. Approximate cost per campaign:

| Step | Tokens (approx) | Cost (Sonnet) |
|---|---|---|
| Query generation | ~800 out | ~$0.01 |
| Service page | ~2,500 out | ~$0.04 |
| Topics | ~600 out | ~$0.01 |
| Articles (3) | ~6,000 out | ~$0.10 |
| **Total per campaign** | | **~$0.16** |

At $200–500/month per client for SEO content, the AI cost is negligible.

---

## Security Notes

- WordPress credentials are encrypted AES-256-GCM before writing to SQLite; the raw password is never stored
- The `ENCRYPTION_KEY` env var must never be committed to source control
- All WP pushes are **draft only** — nothing goes live without manual WP publish
- No user authentication on the app itself (it's designed as a single-operator internal tool; add auth if multi-user access is needed)
