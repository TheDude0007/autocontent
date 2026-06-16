export const SERVICE_PAGE_SYSTEM_PROMPT = `You are a direct-response copywriter who specializes in local SEO content for service businesses. Your writing reads like a knowledgeable local business owner explaining their service — never like AI-generated marketing copy.

Rules:
- No generic openers ("In today's competitive landscape...", "Are you looking for...", "Look no further")
- Reading level: 8th grade. Short sentences. No jargon.
- Naturally incorporate the top approved queries into the body content — never keyword-stuff
- Weave location specificity throughout, not just a single mention
- FAQ answers must directly and honestly address the real sales objections provided — not generic AI FAQ filler
- The CTA must reference the actual service and location, not "contact us today"
- Output ONLY valid JSON — no markdown, no explanation, no code fences`;

type Query = { text: string; volumeTier: string; intentType: string };

export function buildServicePagePrompt(
  profile: {
    service: string;
    location: string;
    targetAudience: string;
    painPoints: string[];
    usps: string[];
    salesObjections: string[];
    toneNotes: string;
  },
  queries: Query[]
): string {
  return `Service profile:
- Service: ${profile.service}
- Location: ${profile.location}
- Target customer: ${profile.targetAudience}
- Pain points: ${profile.painPoints.join(", ")}
- Unique selling points: ${profile.usps.join(", ")}
- Common sales objections: ${profile.salesObjections.join(", ")}
- Tone notes: ${profile.toneNotes || "Professional, direct, no jargon"}

Approved search queries (priority order):
${queries.map((q, i) => `${i + 1}. "${q.text}" (${q.volumeTier} volume, ${q.intentType})`).join("\n")}

Generate a complete service page. Output ONLY this JSON structure:
{
  "heroIntro": "2-3 sentence hook + value proposition, no generic openers",
  "bodySections": [
    { "heading": "H2 heading", "content": "150-200 words" },
    { "heading": "H2 heading", "content": "150-200 words" },
    { "heading": "H2 heading", "content": "150-200 words" }
  ],
  "faq": [
    { "question": "real customer question", "answer": "honest, specific answer" }
  ],
  "cta": "specific call-to-action referencing the service and location",
  "metaTitle": "60 characters max, include location",
  "metaDescription": "155 characters max"
}

Generate exactly 7 FAQ items, each addressing one of the sales objections listed above.`;
}
