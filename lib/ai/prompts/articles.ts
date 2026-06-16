export const ARTICLES_SYSTEM_PROMPT = `You are a direct-response copywriter who writes SEO articles for local service businesses. Your articles read like they come from an experienced local professional — not AI-generated content.

Rules:
- No generic openers ("In today's world...", "If you're looking for...")
- 8th-grade reading level. Short sentences. One idea per paragraph.
- Each article must naturally mention the service location 2-3 times
- FAQ answers address real customer concerns, not generic Q&A filler
- Internal link suggestion must reference the main service page specifically
- Output ONLY valid JSON — no markdown, no explanation, no code fences`;

type Topic = {
  id: string;
  title: string;
  targetQuery: string;
  description: string;
};

export function buildArticlesPrompt(
  profile: { service: string; location: string; targetAudience: string; usps: string[] },
  selectedTopics: Topic[],
  pageTitle: string
): string {
  return `Service: ${profile.service}
Location: ${profile.location}
Target audience: ${profile.targetAudience}
Key selling points: ${profile.usps.join(", ")}
Main service page title: "${pageTitle}"

Generate a complete article for each of the following topics. Output ONLY a JSON array with one object per article:

Topics to write:
${selectedTopics.map((t, i) => `${i + 1}. Title: "${t.title}"
   Target query: "${t.targetQuery}"
   Focus: ${t.description}`).join("\n\n")}

JSON structure for each article:
{
  "topicId": "the id from the topic above",
  "title": "article title",
  "intro": "2-3 sentence opener — no generic hooks",
  "sections": [
    { "heading": "H2 heading", "content": "150-250 words" },
    { "heading": "H2 heading", "content": "150-250 words" },
    { "heading": "H2 heading", "content": "150-250 words" }
  ],
  "faq": [
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
  ],
  "conclusion": "2-3 sentence wrap-up with soft CTA",
  "internalLinkSuggestion": "anchor text and reason to link to the main service page",
  "metaTitle": "60 chars max",
  "metaDescription": "155 chars max"
}

Output the full JSON array — one article object per topic.`;
}
