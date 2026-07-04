// Shared deep-query types used by both the standalone page and campaign article generation
export interface DeepFAQ { question: string; answer: string; }
export interface DeepSubSection { heading: string; content: string; }
export interface DeepCitation { claim: string; sourceType: string; searchQuery: string; }
export interface DeepFacet {
  id: string;
  heading: string;
  content: string;
  subSections?: DeepSubSection[];
  faq: DeepFAQ[];
  mediaBrief: string;
  citationSuggestions: DeepCitation[];
}
export interface DeepRelatedChild { query: string; intent: string; }
export interface DeepRelatedQuery { query: string; intent: string; children: DeepRelatedChild[]; }
export interface DeepQueryResult {
  topicId?: string;         // set when used inside a campaign
  rootQuery: string;
  pageH1: string;
  metaTitle: string;
  metaDescription: string;
  introduction: string;
  semanticFacets: DeepFacet[];
  relatedQueryTree: DeepRelatedQuery[];
  masterFAQ: DeepFAQ[];
  conclusion: string;
  cta: string;
}

export const DEEP_QUERY_SYSTEM_PROMPT = `You are an AI search optimization specialist. Your job is to take a single root search query and produce a complete, authoritative content package — the kind of page that AI search engines (ChatGPT, Perplexity, Google AI Overviews) cite when answering questions on this topic.

Your output must satisfy EVERY facet of the query: not just what the service is, but safety, reviews, pricing, booking, legality, what to expect, how to verify trustworthiness — whatever sub-questions a real person would have. Each facet gets full written content, not an outline.

Rules:
- Write like a knowledgeable insider, not a marketer
- No generic openers ("In today's world...", "Are you looking for...", "Look no further")
- 8th-grade reading level. Short sentences. One idea per paragraph.
- Every FAQ answer must be honest and specific — no AI filler
- Media briefs must describe a SPECIFIC visual concept (not just "add an image here")
- Citation suggestions must name the TYPE of source and what claim it backs up
- Voice instructions in the profile override default tone — apply them throughout
- Output ONLY valid JSON — no markdown fences, no explanation, nothing outside the JSON object`;

export interface DeepQueryInput {
  rootQuery: string;
  businessName: string;
  location: string;
  serviceType: string;
  usps: string;
  voiceProfile?: string;
}

export function buildDeepQueryPrompt(input: DeepQueryInput): string {
  const voice = input.voiceProfile?.trim()
    ? `\nVoice & tone instructions (apply throughout all content):\n${input.voiceProfile}`
    : "";

  return `Root query to dominate: "${input.rootQuery}"

Business context:
- Business name: ${input.businessName}
- Location: ${input.location}
- Service type: ${input.serviceType}
- Key differentiators / USPs: ${input.usps}${voice}

Your task: produce a complete content intelligence package for this query. Think through EVERY angle a real person searching this query might have — safety concerns, pricing curiosity, trust/verification questions, how-it-works questions, comparison questions, what-to-expect questions, legal questions, review authenticity, booking process. Then write full content for each.

Output ONLY this JSON structure — no markdown, no code fences, nothing before or after the opening brace:

{
  "rootQuery": "${input.rootQuery}",
  "pageH1": "compelling H1 heading for the page (includes primary keyword naturally)",
  "metaTitle": "60-char max page title including location and primary keyword",
  "metaDescription": "155-char max meta description — factual hook, no hype",
  "introduction": "150-200 word page intro. No generic opener. Lead with the most important thing a reader wants to know. Establish credibility immediately. Mention ${input.businessName} and ${input.location} naturally.",

  "semanticFacets": [
    {
      "id": "facet_slug",
      "heading": "H2 section heading",
      "content": "300-400 words of full, readable prose for this facet. Real paragraphs. Mention specific details, not vague generalities. This content must fully satisfy someone who searched specifically about this sub-topic.",
      "subSections": [
        {
          "heading": "H3 sub-heading (optional — only if this facet naturally has sub-points)",
          "content": "100-150 words"
        }
      ],
      "faq": [
        {
          "question": "exact question a real person would type or ask",
          "answer": "honest, specific 2-4 sentence answer — no hedging, no filler"
        }
      ],
      "mediaBrief": "Describe a SPECIFIC image or graphic concept for this section. Example: 'Split image: left side shows unverified stranger at door (dark, ominous), right side shows professional performer in branded uniform with visible ID badge (bright, reassuring). Caption: What booking with a verified agency looks like.'",
      "citationSuggestions": [
        {
          "claim": "specific claim in this section that benefits from an external source",
          "sourceType": "type of source (e.g. Nevada state entertainment licensing database, BBB rating page, Google Maps reviews, health department inspection records)",
          "searchQuery": "exact Google search someone would use to find this source"
        }
      ]
    }
  ],

  "relatedQueryTree": [
    {
      "query": "related question or search someone would ask after reading this page",
      "intent": "Informational | Transactional | Navigational",
      "children": [
        {
          "query": "follow-up question that comes after the parent question is answered",
          "intent": "Informational | Transactional | Navigational"
        }
      ]
    }
  ],

  "masterFAQ": [
    {
      "question": "top-level question that didn't fit a specific facet",
      "answer": "specific, honest 2-4 sentence answer"
    }
  ],

  "conclusion": "150-word wrap-up that summarizes the key trust signals, restates the differentiators, and ends with a soft call to action referencing ${input.businessName} specifically.",
  "cta": "One specific CTA sentence — references the actual service and ${input.location}, not generic 'contact us today'"
}

Generate 5-8 semantic facets covering every major angle of the query. Generate 8-12 related queries in the tree with 2-3 children each. Generate 5-8 master FAQ items covering what the facets didn't address. Make the content genuinely useful — AI search engines cite content that actually answers the question, not content that dances around it.`;
}

export interface DeepArticleTopic {
  id: string;
  title: string;
  targetQuery: string;
  description: string;
}

export function buildDeepArticlesPrompt(
  profile: { service: string; location: string; businessName: string; usps: string[]; toneNotes?: string },
  topics: DeepArticleTopic[]
): string {
  const voice = profile.toneNotes?.trim()
    ? `\nVoice & tone (apply to all articles): ${profile.toneNotes}`
    : "";

  return `Service: ${profile.service}
Business name: ${profile.businessName}
Location: ${profile.location}
Key differentiators: ${profile.usps.join(", ")}${voice}

You are generating ${topics.length} full content intelligence package(s), one per article topic below. Each package must meet deep query standards: semantic facet decomposition, full prose per facet, per-facet FAQ, specific media briefs, citation suggestions, related query tree, master FAQ.

Topics:
${topics.map((t, i) => `${i + 1}. Topic ID: "${t.id}"
   Title: "${t.title}"
   Target query: "${t.targetQuery}"
   Focus: ${t.description}`).join("\n\n")}

Output ONLY a JSON array — one object per topic, in the same order. Each object:
{
  "topicId": "the topic id from above",
  "rootQuery": "the targetQuery for this topic",
  "pageH1": "compelling H1 heading for this article",
  "metaTitle": "60-char max including location and primary keyword",
  "metaDescription": "155-char max — factual, no hype",
  "introduction": "150-200 words. No generic opener. Lead with the most important thing a reader wants to know.",
  "semanticFacets": [
    {
      "id": "facet-slug",
      "heading": "H2 section heading",
      "content": "250-350 words of full readable prose. Real paragraphs. Satisfy someone searching specifically about this sub-topic.",
      "subSections": [
        { "heading": "H3 sub-heading", "content": "80-120 words" }
      ],
      "faq": [
        { "question": "exact question a real person would ask", "answer": "honest, specific 2-4 sentence answer" }
      ],
      "mediaBrief": "Specific visual concept — describe the exact image/graphic, not just 'add a photo'",
      "citationSuggestions": [
        { "claim": "specific claim needing external backing", "sourceType": "type of authoritative source", "searchQuery": "Google search to find it" }
      ]
    }
  ],
  "relatedQueryTree": [
    {
      "query": "related search after reading this article",
      "intent": "Informational | Transactional | Navigational",
      "children": [
        { "query": "follow-up question", "intent": "Informational | Transactional | Navigational" }
      ]
    }
  ],
  "masterFAQ": [
    { "question": "top-level question not covered by facets", "answer": "specific, honest 2-4 sentence answer" }
  ],
  "conclusion": "100-150 words. Summarize key points, soft CTA referencing ${profile.businessName}.",
  "cta": "One specific CTA referencing the service and ${profile.location}"
}

Generate 4-6 semantic facets per article. Generate 5-8 related queries per article with 2-3 children each. Generate 4-6 master FAQ items per article. Output the JSON array only — no markdown, no explanation.`;
}
