# PRD: AI-Powered SEO Content & WordPress Publishing Tool

**Status:** Draft  
**Version:** 1.0  
**Date:** 2026-06-15  
**Pilot Client:** Las Vegas web design company

---

## 1. Problem Statement

Web design agencies need content that ranks in both traditional search and AI-powered search (ChatGPT, Perplexity, AI Overviews). Existing options are either fully manual (slow, expensive) or fully automated AI (generic "AI slop"). No tool occupies the middle ground: AI speed with human curation at every decision point.

---

## 2. Goals

| Goal | Measure |
|------|---------|
| Generate service page + article cluster per service | < 2 hours per campaign from input to WP draft |
| Content quality | Passes human review without full rewrites |
| AI search visibility | Pages appear in AI citations within 60 days of publish |
| Cost model | Pay-per-token via Claude API — no recurring subscription |
| Scalability | Reusable across multiple client WP sites |

---

## 3. User Personas

### Primary — Content Manager / Agency Operator
- Manages content for multiple client sites
- Comfortable with web tools, not a developer
- Interacts with every review/approval gate
- Wants speed without sacrificing brand voice

### Secondary — Agency Developer / Admin
- Sets up WP integration and template schemas
- Configures credentials, Divi/ACF mappings
- May deploy for multiple client sites

---

## 4. Core Workflow (User-Facing)

```
[1] Input service details
     ↓
[2] AI generates search query brainstorm  ← HUMAN REVIEW GATE
     ↓
[3] AI generates main service page        ← HUMAN REVIEW/EDIT GATE
     ↓
[4] AI suggests supporting article topics ← HUMAN SELECTION GATE
     ↓
[5] AI generates full articles            ← HUMAN REVIEW/EDIT GATE (per article)
     ↓
[6] Format output → JSON → WP REST API push as drafts
     ↓
[7] Human final review + publish in WordPress
```

---

## 5. Functional Requirements

### Epic A — Service Profile Intake
| ID | Requirement | Priority |
|----|-------------|----------|
| A1 | Input form: service name, location, target audience, pain points, USPs, sales objections, tone/style notes | Must |
| A2 | Save and reload service profiles for repeat campaigns | Must |
| A3 | List, edit, and delete saved service profiles | Must |

### Epic B — Query Research & Prioritization
| ID | Requirement | Priority |
|----|-------------|----------|
| B1 | Generate customer search query brainstorm from service profile via Claude API (streaming) | Must |
| B2 | Each query tagged with: volume tier (High/Med/Low) and intent type (Informational/Transactional/Navigational) | Must |
| B3 | Editable review UI — user can remove, reorder, or manually add queries | Must |
| B4 | Approve query list to unlock page generation | Must |

### Epic C — Main Service Page Generation
| ID | Requirement | Priority |
|----|-------------|----------|
| C1 | Generate service page content using approved queries + service profile | Must |
| C2 | Page sections: hero intro, body content (H2/H3 structure), FAQ (min 5 items), CTA block, meta title, meta description | Must |
| C3 | Editable per-section review interface before approval | Must |
| C4 | Gate: article planning is locked until main page is approved | Must |
| C5 | Regenerate individual sections without re-running the full page | Should |

### Epic D — Supporting Article Planning
| ID | Requirement | Priority |
|----|-------------|----------|
| D1 | Generate article topic suggestions (title + 2-sentence description) based on approved page + remaining queries | Must |
| D2 | Checkbox UI to select which articles to generate | Must |
| D3 | Show estimated query coverage for each suggested topic | Should |

### Epic E — Supporting Article Generation
| ID | Requirement | Priority |
|----|-------------|----------|
| E1 | Generate full article per selected topic (streaming) | Must |
| E2 | Article structure: intro, H2 body sections, internal link suggestion, FAQ, conclusion, meta title + description | Must |
| E3 | Per-article editable review interface | Must |
| E4 | Generate articles in parallel when multiple selected | Should |

### Epic F — Template Mapping System
| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Define JSON schema mapping variable names (e.g., `hero_intro`) to ACF field names + Divi module IDs | Must |
| F2 | Import/export template JSON files | Must |
| F3 | Support multiple templates (service page layout, article layout) | Must |
| F4 | UI for viewing current template structure | Should |
| F5 | Validate template schema has all required block types | Must |

### Epic G — Output Formatting Engine
| ID | Requirement | Priority |
|----|-------------|----------|
| G1 | Map approved content blocks to template variable names | Must |
| G2 | Validate all required template slots are populated before export | Must |
| G3 | Generate structured JSON payload per template schema | Must |
| G4 | Generate WordPress HTML for `post_content` (fallback / non-ACF support) | Should |

### Epic H — WordPress Integration
| ID | Requirement | Priority |
|----|-------------|----------|
| H1 | Configure WP site URL + Application Password credentials (stored server-side, never exposed to client) | Must |
| H2 | Create draft post/page via `POST /wp-json/wp/v2/pages` | Must |
| H3 | Write content to ACF custom fields via `POST /wp-json/acf/v3/pages/{id}` | Must |
| H4 | Write Yoast/RankMath SEO meta fields via REST | Should |
| H5 | Handle media placeholders as descriptive text markers in ACF fields | Must |
| H6 | Return WP admin edit links for each created draft | Must |
| H7 | Test connection before first push | Must |
| H8 | Support multiple WP sites from one installation | Should |

### Epic I — Campaign Dashboard & Publish Loop
| ID | Requirement | Priority |
|----|-------------|----------|
| I1 | Dashboard listing all campaigns with current state and client/site | Must |
| I2 | Resume any campaign from any saved state | Must |
| I3 | Display WP admin links after push for final review | Must |
| I4 | Mark campaign complete after publish confirmed | Should |

---

## 6. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Streaming | All Claude API calls stream tokens to UI — no blank wait screens |
| Persistence | Campaign state auto-saves; browser close + reopen resumes where left off |
| Security | WP credentials encrypted at rest, never transmitted to frontend |
| Cost visibility | Estimated token cost shown before each Claude API call; actual cost shown after |
| Performance | Page generation completes streaming within 60 seconds |
| Portability | Tool runs as self-hosted Next.js app; deployable to Vercel or VPS |

---

## 7. Content Quality Requirements (AI Output Standards)

These govern prompt design and review criteria:

- **No generic openers**: No "In today's competitive landscape…" or "Are you looking for…"
- **Local specificity**: Location-specific details woven into content naturally
- **Query integration**: Top 3 approved queries must appear naturally (not keyword-stuffed) in the service page
- **FAQ authenticity**: Questions must reflect real sales objections from the profile, not generic AI FAQ patterns
- **Reading level**: Target 8th grade (Flesch-Kincaid) — clear, direct, no jargon
- **CTA specificity**: CTAs reference the actual service + location, not generic "contact us today"

---

## 8. Out of Scope (v1)

- Auto-publishing without human review
- Automated image generation or stock library integration
- Multi-language content generation
- Analytics / performance tracking of published content
- Multi-user / team collaboration (single-user install)
- Social media content generation from approved pages

---

## 9. Open Questions → Resolved

| Question | Decision | Rationale |
|----------|----------|-----------|
| WP REST API auth | Application Passwords | No OAuth server needed; simpler for small-team tool |
| Template definition method | JSON config file | Portable, developer-managed, version-controllable |
| Media handling | Placeholders only (descriptive text) | AI image gen is explicitly out of scope v1 |
| Where tool lives | Next.js web app (self-hosted) | Multi-step gated UI requires proper frontend; CLI won't work |
| Claude model | `claude-sonnet-4-6` | Best quality/cost ratio; estimated ~$0.45–0.60/full campaign |

---

## 10. Success Criteria (Pilot Sign-off)

- [ ] Complete campaign (1 service page + 3+ articles) generated end-to-end without errors
- [ ] WP drafts appear correctly in Divi with all ACF fields populated
- [ ] Content passes internal review without requiring full section rewrites
- [ ] Time-to-WP-draft < 2 hours per service
- [ ] Token cost per campaign tracked and under $1.00
