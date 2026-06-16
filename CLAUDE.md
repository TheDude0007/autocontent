# AI SEO Tool — CLAUDE.md

## What This Is
A Next.js web app that generates SEO/AI-search-optimized content (service pages + article clusters) with human review gates at every stage, then pushes approved content to WordPress as drafts via WP REST API + ACF.

## Stack
- **Framework**: Next.js 14 (App Router, TypeScript)
- **UI**: React + Tailwind CSS + shadcn/ui
- **Database**: SQLite via Prisma ORM (`lib/db.ts` — singleton client)
- **AI**: Anthropic `claude-sonnet-4-6` via `@anthropic-ai/sdk` (streaming SSE)
- **WP Integration**: WP REST API + ACF REST API + Application Passwords auth

## Dev Commands
```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npx prisma studio    # Browse database
npx prisma migrate dev --name <name>  # Create migration
```

## Environment Variables (`.env.local`)
```
ANTHROPIC_API_KEY=sk-ant-...
ENCRYPTION_KEY=<32-byte hex>    # AES-256 for WP credential encryption
DATABASE_URL=file:./dev.db
```

## Key Architecture Decisions
- WP credentials encrypted AES-256-GCM in SQLite; decrypted server-side only at push time
- AI calls always stream (SSE) — never block waiting for full response
- Campaign state machine gates each step — can't skip forward
- Template system uses JSON schema (variableName → ACF field name mapping)
- Media = placeholders only in v1 (descriptive text in ACF fields)

## Docs
- `docs/prd.md` — full requirements
- `docs/architecture.md` — data models, API routes, WP integration detail
- `docs/epic-1-scaffold-and-profiles.md` — Story 1 (current sprint)
