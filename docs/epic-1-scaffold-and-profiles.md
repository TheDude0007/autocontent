# Epic 1: Project Scaffold + Service Profile CRUD

**Status:** Ready for Development  
**Sprint:** 1  
**Epic Owner:** Dev  
**Depends On:** Nothing (first epic)

---

## Epic Goal

Stand up the Next.js app with database, routing skeleton, and fully working Service Profile CRUD. After this epic, a user can create, save, edit, and reload service profiles — and the campaign wizard can be seeded from a saved profile.

---

## Story 1.1 — Project Scaffold

**As a** developer,  
**I want** a working Next.js 14 app with Prisma + SQLite, Tailwind, and shadcn/ui configured,  
**so that** all subsequent stories have a consistent foundation to build on.

### Acceptance Criteria
- [ ] `npx create-next-app` scaffold with App Router, TypeScript, Tailwind
- [ ] Prisma initialized with SQLite (`DATABASE_URL=file:./dev.db`)
- [ ] `ServiceProfile`, `Campaign`, `Template`, `WPSite` models in `schema.prisma` (see Architecture §3)
- [ ] `prisma migrate dev` runs clean with no errors
- [ ] shadcn/ui initialized; `Button`, `Input`, `Textarea`, `Card`, `Badge` components added
- [ ] `.env.local` with `ANTHROPIC_API_KEY` and `ENCRYPTION_KEY` placeholders documented in README
- [ ] Root layout with sidebar nav: Dashboard / Profiles / Templates / Settings
- [ ] `CLAUDE.md` in project root with stack summary and `npm run dev` instruction

### Tasks
1. `npx create-next-app@latest ai-seo-tool --typescript --tailwind --app`
2. `npm install prisma @prisma/client` + init
3. Write `schema.prisma` per Architecture §3
4. `npx prisma migrate dev --name init`
5. `npx shadcn@latest init` + add base components
6. Create root `layout.tsx` with sidebar shell
7. Create `lib/db.ts` — singleton Prisma client
8. Write `CLAUDE.md`

### Dev Notes
- Use `better-sqlite3` driver (no async) — simpler for local use
- Sidebar items: Campaign list (Dashboard), Profiles, Templates, Settings

---

## Story 1.2 — Service Profile API

**As a** content manager,  
**I want** REST API endpoints for service profiles,  
**so that** the UI can create, read, update, and delete them.

### Acceptance Criteria
- [ ] `GET /api/profiles` → returns array of all profiles (id, name, service, location, createdAt)
- [ ] `POST /api/profiles` → creates profile, returns created record
- [ ] `GET /api/profiles/[id]` → returns full profile
- [ ] `PUT /api/profiles/[id]` → updates profile fields, returns updated record
- [ ] `DELETE /api/profiles/[id]` → deletes profile, returns 204
- [ ] All routes validate required fields (service, location, targetAudience) and return 400 with error message on missing
- [ ] `painPoints`, `usps`, `salesObjections` stored as JSON strings; deserialized as arrays in API response

### Tasks
1. `app/api/profiles/route.ts` — GET list + POST create
2. `app/api/profiles/[id]/route.ts` — GET one + PUT update + DELETE
3. Add Zod schema for ServiceProfile input validation
4. Unit test: create profile → fetch → verify fields match

### Dev Notes
- Use `JSON.stringify` / `JSON.parse` for array fields (SQLite stores as TEXT)
- Add `npm install zod` for validation

---

## Story 1.3 — Service Profile UI

**As a** content manager,  
**I want** a page to create and manage service profiles,  
**so that** I can define client service details once and reuse them across campaigns.

### Acceptance Criteria
- [ ] `/profiles` page lists all saved profiles as cards (name, service, location, created date)
- [ ] "New Profile" button opens form (inline or modal)
- [ ] Form fields: Profile Name, Service, Location, Target Audience, Pain Points (textarea), USPs (textarea), Sales Objections (textarea), Tone Notes (textarea)
- [ ] Pain Points / USPs / Sales Objections help text explains: "Enter one per line"
- [ ] Save creates profile via API; card appears in list without page reload
- [ ] Each card has Edit and Delete actions
- [ ] Edit opens same form pre-filled
- [ ] Delete shows confirmation before API call
- [ ] Empty state: friendly message + "Create your first profile" CTA

### Tasks
1. `app/profiles/page.tsx` — profile list with fetch
2. `ProfileCard.tsx` component — name, service, location, edit/delete actions
3. `ProfileForm.tsx` component — controlled form with all fields
4. Wire create / update / delete to API routes
5. Toast notification on save/delete success

### Dev Notes
- Pain points etc. stored as newline-separated text in textarea; split on save; join on load
- No pagination needed for v1 (internal tool with < 50 profiles realistically)

---

## Story 1.4 — Campaign Creation Entry Point

**As a** content manager,  
**I want** to start a new campaign by selecting a saved service profile,  
**so that** all campaign steps are pre-seeded with the client's service details.

### Acceptance Criteria
- [ ] Dashboard (`/`) lists all campaigns with: profile name, service, state badge, last updated, resume link
- [ ] "New Campaign" button on dashboard navigates to `/campaigns/new`
- [ ] `/campaigns/new` shows profile selector — list/grid of saved profiles with key details
- [ ] Selecting a profile and clicking "Start Campaign" creates a Campaign record (state: `INPUT_COMPLETE`) and redirects to `/campaigns/[id]/queries`
- [ ] If no profiles exist, `/campaigns/new` shows prompt to create a profile first
- [ ] Campaign card on dashboard shows state as human-readable label: "Awaiting Query Approval", "Page In Review", "Ready to Publish", etc.
- [ ] Resume link on campaign card goes to the correct step for its current state

### Tasks
1. `app/page.tsx` — dashboard with campaign list
2. `CampaignCard.tsx` — state badge + resume link logic
3. `app/campaigns/new/page.tsx` — profile selector
4. `POST /api/campaigns` — create campaign with `serviceProfileId`
5. State → route mapping helper: `getCampaignStepRoute(state: CampaignState): string`
6. Placeholder stub pages for `/campaigns/[id]/queries` (just "Coming in Epic 2")

### Dev Notes
- State badge colors: gray (early), yellow (awaiting review), green (approved), blue (complete)
- `getCampaignStepRoute` lives in `lib/campaign-routing.ts` — reused by all campaign pages for back-redirect guard

---

## Epic 1 Definition of Done

- [ ] All 4 stories pass acceptance criteria
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] `npm run dev` serves the app with sidebar navigation working
- [ ] Profile CRUD fully functional end-to-end in browser
- [ ] New campaign can be created from a saved profile
- [ ] Dashboard shows campaign list with state badges
- [ ] No hardcoded test data in committed code
