export const TOPICS_SYSTEM_PROMPT = `You are an SEO content strategist. Given an approved service page and a set of search queries, you suggest supporting article topics that strengthen the page's topical authority and answer real customer questions.

Rules:
- Each topic must target a distinct search query not already covered by the main service page
- Topics should map to informational intent: "how to", "what is", "cost of", comparison, local guides
- No duplicate angles — every topic must offer a unique perspective
- Output ONLY valid JSON — no markdown, no explanation, no code fences`;

type Query = { text: string; volumeTier: string; intentType: string };

export function buildTopicsPrompt(
  profile: { service: string; location: string; targetAudience: string },
  approvedQueries: Query[],
  pageHeroIntro: string
): string {
  return `Service: ${profile.service}
Location: ${profile.location}
Target audience: ${profile.targetAudience}

Main service page intro (already written, don't duplicate):
"${pageHeroIntro}"

Approved search queries:
${approvedQueries.map((q, i) => `${i + 1}. "${q.text}" (${q.volumeTier} volume, ${q.intentType})`).join("\n")}

Generate 8 article topic suggestions that support the main service page. Output ONLY this JSON array:
[
  {
    "id": "topic_1",
    "title": "article title as it would appear in a blog",
    "targetQuery": "the specific search query this article targets",
    "value": "High" or "Medium",
    "description": "one sentence on what this article covers and why it helps"
  }
]`;
}
