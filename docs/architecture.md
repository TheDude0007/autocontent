# Architecture: AI-Powered SEO Content & WordPress Publishing Tool

**Status:** Draft  
**Version:** 1.0  
**Date:** 2026-06-15

---

## 1. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 14 (App Router) | Frontend + backend in one; streaming SSE support; easy Vercel deploy |
| UI | React + Tailwind CSS + shadcn/ui | Rapid, consistent component library |
| Database | SQLite via Prisma ORM | Single-tenant tool; zero-infra; file-portable |
| AI | Anthropic `claude-sonnet-4-6` via `@anthropic-ai/sdk` | Streaming support; best quality/cost for long-form content |
| WP Integration | WP REST API + ACF REST API | Standard, stable; Application Password auth |
| Crypto | Node.js `crypto` (AES-256-GCM) | Encrypt WP credentials at rest |
| Styling | Tailwind CSS | Fast iteration; consistent design tokens |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser (React)                    │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │ Campaign │  │  Review  │  │   Template/Config   │ │
│  │ Wizard   │  │   Gates  │  │       Manager       │ │
│  └────┬─────┘  └────┬─────┘  └─────────┬──────────┘ │
└───────┼─────────────┼───────────────────┼────────────┘
        │  SSE Stream │                   │ REST
        ▼             ▼                   ▼
┌─────────────────────────────────────────────────────┐
│               Next.js API Routes                     │
│  ┌───────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  AI Pipeline  │  │ Campaign │  │  WP Pusher   │  │
│  │  (streaming)  │  │  State   │  │  (server     │  │
│  │               │  │  Manager │  │   side only) │  │
│  └───────┬───────┘  └────┬─────┘  └──────┬───────┘  │
└──────────┼───────────────┼───────────────┼───────────┘
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐  ┌──────────┐  ┌──────────────────┐
    │ Anthropic   │  │  SQLite  │  │  WordPress Site   │
    │ Claude API  │  │  (local) │  │  WP REST + ACF   │
    └─────────────┘  └──────────┘  └──────────────────┘
```

---

## 3. Data Models (Prisma Schema)

```prisma
model ServiceProfile {
  id              String     @id @default(cuid())
  name            String
  service         String
  location        String
  targetAudience  String
  painPoints      String     // JSON array stored as string
  usps            String     // JSON array
  salesObjections String     // JSON array
  toneNotes       String
  campaigns       Campaign[]
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}

model Campaign {
  id               String         @id @default(cuid())
  serviceProfileId String
  serviceProfile   ServiceProfile @relation(fields: [serviceProfileId], references: [id])
  templateId       String?
  wpSiteId         String?
  state            CampaignState  @default(INPUT_COMPLETE)

  // Stage B
  generatedQueries  String?  // JSON: Query[]
  approvedQueries   String?  // JSON: Query[]

  // Stage C
  mainPageDraft     String?  // JSON: ContentBlock[]
  mainPageApproved  String?  // JSON: ContentBlock[]

  // Stage D
  articleTopics     String?  // JSON: ArticleTopic[]
  selectedTopicIds  String?  // JSON: string[]

  // Stage E
  generatedArticles String?  // JSON: Article[]

  // Stage G
  formattedOutput   String?  // JSON: FormattedOutput

  // Stage H
  wpPageDraftId     Int?
  wpArticleDraftIds String?  // JSON: number[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum CampaignState {
  INPUT_COMPLETE
  QUERIES_GENERATED
  QUERIES_APPROVED
  PAGE_GENERATED
  PAGE_APPROVED
  TOPICS_GENERATED
  ARTICLES_SELECTED
  ARTICLES_GENERATED
  OUTPUT_FORMATTED
  WP_PUSHED
  COMPLETE
}

model Template {
  id       String          @id @default(cuid())
  name     String
  pageType TemplateType
  blocks   TemplateBlock[]
  createdAt DateTime       @default(now())
}

model TemplateBlock {
  id           String      @id @default(cuid())
  templateId   String
  template     Template    @relation(fields: [templateId], references: [id])
  variableName String      // e.g., "hero_intro"
  acfFieldName String      // e.g., "service_hero_text"
  diviModuleId String?     // for documentation only
  contentType  ContentType
  required     Boolean     @default(true)
  order        Int
}

enum TemplateType {
  SERVICE_PAGE
  ARTICLE
  LANDING_PAGE
}

enum ContentType {
  TEXT
  FAQ
  HEADING
  CTA
  META_TITLE
  META_DESCRIPTION
  MEDIA_PLACEHOLDER
}

model WPSite {
  id                   String @id @default(cuid())
  name                 String
  url                  String
  username             String
  appPasswordEncrypted String  // AES-256-GCM encrypted
  iv                   String  // encryption IV
  createdAt            DateTime @default(now())
}
```

---

## 4. TypeScript Interfaces (Application Layer)

```typescript
interface Query {
  id: string
  text: string
  volumeTier: 'High' | 'Medium' | 'Low'
  intentType: 'Informational' | 'Transactional' | 'Navigational'
}

interface ContentBlock {
  id: string
  blockType: 'hero_intro' | 'body_section' | 'faq' | 'cta' | 'meta_title' | 'meta_description'
  heading?: string
  content: string        // Markdown
  items?: FAQItem[]      // for faq blockType
}

interface FAQItem {
  question: string
  answer: string
}

interface ArticleTopic {
  id: string
  title: string
  description: string
  targetQueries: string[]
  selected: boolean
}

interface Article {
  topicId: string
  title: string
  metaTitle: string
  metaDescription: string
  intro: string
  sections: { heading: string; content: string }[]
  faq: FAQItem[]
  conclusion: string
  internalLinkSuggestion: string
}

interface FormattedOutput {
  templateId: string
  pageType: TemplateType
  page: Record<string, FormattedBlock>      // variableName → content
  articles: Record<string, FormattedBlock>[]
}

interface FormattedBlock {
  contentType: ContentType
  value: string | FAQItem[]
}
```

---

## 5. API Route Structure

```
/api/
  profiles/
    GET                    → list all service profiles
    POST                   → create service profile
    [id]/
      GET                  → get profile
      PUT                  → update profile
      DELETE               → delete profile

  campaigns/
    GET                    → list all campaigns
    POST                   → create campaign (with serviceProfileId)
    [id]/
      GET                  → get full campaign state
      PUT                  → update campaign fields
      queries/
        POST               → generate queries (SSE stream)
        approve/POST       → save approved query list + advance state
      page/
        POST               → generate main service page (SSE stream)
        approve/POST       → save approved page + advance state
      topics/
        POST               → generate article topics (SSE stream)
        select/POST        → save selected topic IDs + advance state
      articles/
        [topicIndex]/POST  → generate single article (SSE stream)
        approve/POST       → mark all articles reviewed + advance state
      format/POST          → run output formatter + advance state
      publish/POST         → push to WordPress + advance state

  templates/
    GET, POST
    [id]/GET, PUT, DELETE

  sites/
    GET, POST
    [id]/GET, PUT, DELETE
    [id]/test/POST         → test WP connection
```

---

## 6. Frontend Route Structure

```
/                              → Dashboard: all campaigns, quick-create
/campaigns/new                 → Step 1: select or create service profile
/campaigns/[id]/queries        → Step 2: review/edit/approve query brainstorm
/campaigns/[id]/page           → Step 3: review/edit/approve main service page
/campaigns/[id]/topics         → Step 4: select article topics
/campaigns/[id]/articles       → Step 5: review/edit generated articles
/campaigns/[id]/publish        → Step 6: format preview + WP push + confirmation
/profiles                      → Manage service profiles
/templates                     → Manage Divi template schemas
/settings                      → WP site credentials
```

Each campaign route checks state and redirects backward if a gate hasn't been passed.

---

## 7. AI Prompt Architecture

Each stage has a dedicated system prompt + user prompt. All use streaming.

### B — Query Research Prompt

```
System: You are an SEO strategist specializing in local service businesses...
        [persona, quality rules, format instructions]

User:   Service: {service}
        Location: {location}
        Target customer: {targetAudience}
        
        Generate 20-30 search queries customers use when looking for this service.
        For each query output: query text, volume tier (High/Med/Low), intent type.
        
        Output as JSON array. Do not wrap in markdown.
```

### C — Service Page Generation Prompt

```
System: You are a direct-response copywriter who specializes in local SEO content...
        Rules: no generic openers, no jargon, reading level 8th grade,
        naturally incorporate top 3 queries without keyword stuffing...
        [full quality ruleset]

User:   Service profile: {JSON}
        Approved queries (prioritized): {JSON}
        
        Generate the following sections in JSON:
        - hero_intro (2-3 sentences, hook + value prop)
        - body_section x3 (H2 + content, 150-200 words each)
        - faq (7 items, drawn from sales objections)
        - cta_block (specific CTA with service + location)
        - meta_title (60 chars max)
        - meta_description (155 chars max)
```

### D — Article Topics Prompt

```
User:   Approved service page: {JSON}
        Remaining queries not addressed in service page: {JSON}
        
        Suggest supporting article topics. Only suggest articles that:
        1. Address genuine customer questions not covered by the service page
        2. Create a natural internal link opportunity to the service page
        
        Output JSON: title, 2-sentence description, target queries covered.
        Maximum 8 suggestions. Quality over quantity.
```

### E — Article Generation Prompt

```
User:   Topic: {title}
        Target queries: {queries}
        Service page context (for internal linking): {summary}
        Service profile: {JSON}
        
        Generate a complete article (700-1200 words):
        - intro (no generic openers)
        - 3-4 H2 sections
        - FAQ (5 items)
        - conclusion with natural CTA to service page
        - meta title + description
```

---

## 8. WordPress / Divi Integration

### One-Time WP Setup (per client site)

1. Install **ACF Pro** on WordPress
2. Create ACF Field Group named `seo_tool_content` with fields matching template schema
3. In Divi, set module Dynamic Content sources → ACF fields
4. Create Application Password for API user (Editor role minimum)

### Push Flow

```typescript
async function pushToWordPress(campaign: Campaign, site: WPSite, template: Template) {
  const creds = decryptCredentials(site)
  const authHeader = 'Basic ' + Buffer.from(`${site.username}:${creds}`).toString('base64')

  // 1. Create draft page
  const page = await fetch(`${site.url}/wp-json/wp/v2/pages`, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: campaign.mainPageApproved.metaTitle,
      status: 'draft',
      content: generateFallbackHTML(campaign.formattedOutput.page), // plain HTML fallback
    })
  })

  // 2. Write ACF fields
  await fetch(`${site.url}/wp-json/acf/v3/pages/${page.id}`, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: mapToACFFields(campaign.formattedOutput.page, template) })
  })

  // 3. Write SEO meta (Yoast)
  await fetch(`${site.url}/wp-json/wp/v2/pages/${page.id}`, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      meta: {
        _yoast_wpseo_title: campaign.mainPageApproved.metaTitle,
        _yoast_wpseo_metadesc: campaign.mainPageApproved.metaDescription,
      }
    })
  })

  return page.id
}
```

### Media Placeholders

Content stored in ACF field as: `[MEDIA PLACEHOLDER: hero image — web designer reviewing wireframes with Las Vegas client]`

Content manager replaces with actual image in WP admin before publishing.

---

## 9. Security

| Concern | Approach |
|---------|----------|
| WP credentials | AES-256-GCM encrypted in SQLite; decrypted server-side only at push time |
| Encryption key | Set via `ENCRYPTION_KEY` env var (never committed) |
| Claude API key | Server-side env var only; never transmitted to browser |
| CORS | Next.js default: API routes same-origin only |
| Input sanitization | Strip HTML from all user inputs before storing or injecting into prompts |

---

## 10. Streaming Architecture (SSE)

All AI generation routes use Server-Sent Events:

```typescript
// /api/campaigns/[id]/queries/route.ts
export async function POST(req: Request) {
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: buildQueryPrompt(profile) }],
    system: QUERY_SYSTEM_PROMPT,
  })

  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta') {
            controller.enqueue(`data: ${JSON.stringify(chunk.delta)}\n\n`)
          }
        }
        // Save completed content to DB
        await saveQueriesToCampaign(campaignId, await stream.finalMessage())
        controller.enqueue('data: [DONE]\n\n')
        controller.close()
      }
    }),
    { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
  )
}
```

---

## 11. File Structure

```
ai-seo-tool/
├── app/
│   ├── (dashboard)/
│   │   └── page.tsx                  # Campaign dashboard
│   ├── campaigns/
│   │   ├── new/page.tsx
│   │   └── [id]/
│   │       ├── queries/page.tsx
│   │       ├── page/page.tsx
│   │       ├── topics/page.tsx
│   │       ├── articles/page.tsx
│   │       └── publish/page.tsx
│   ├── profiles/page.tsx
│   ├── templates/page.tsx
│   ├── settings/page.tsx
│   └── api/
│       ├── profiles/[...]/route.ts
│       ├── campaigns/[...]/route.ts
│       ├── templates/[...]/route.ts
│       └── sites/[...]/route.ts
├── lib/
│   ├── ai/
│   │   ├── prompts/
│   │   │   ├── queries.ts
│   │   │   ├── service-page.ts
│   │   │   ├── article-topics.ts
│   │   │   └── article.ts
│   │   └── stream.ts
│   ├── wp/
│   │   ├── client.ts
│   │   └── formatter.ts
│   ├── crypto.ts
│   └── db.ts
├── prisma/
│   └── schema.prisma
├── components/
│   ├── campaign/
│   │   ├── QueryReviewPanel.tsx
│   │   ├── ContentBlockEditor.tsx
│   │   ├── ArticleTopicSelector.tsx
│   │   └── PublishConfirmation.tsx
│   └── ui/                           # shadcn/ui components
├── docs/
│   ├── prd.md
│   └── architecture.md
├── .env.local                        # ANTHROPIC_API_KEY, ENCRYPTION_KEY
├── CLAUDE.md
└── package.json
```

---

## 12. Environment Variables

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...
ENCRYPTION_KEY=<32-byte hex for AES-256>

# Optional overrides
CLAUDE_MODEL=claude-sonnet-4-6
DATABASE_URL=file:./dev.db
```

---

## 13. Build Order (matches PRD Priority)

| Phase | Component | Est. |
|-------|-----------|------|
| 1 | Project scaffold (Next.js + Prisma + shadcn setup) | 0.5 days |
| 2 | A — Service Profile CRUD | 1.5 days |
| 3 | F — Template schema definition (JSON import + DB) | 2 days |
| 4 | B — Query generation + review UI | 2 days |
| 5 | C — Service page generation + review UI | 3 days |
| 6 | D/E — Article topics + generation + review UI | 3 days |
| 7 | G — Output formatter + validation | 2 days |
| 8 | H — WP REST push + credential management | 3 days |
| 9 | I — Dashboard + publish loop polish | 2 days |
| **Total** | | **~19 days / 5–7 weeks part-time** |
