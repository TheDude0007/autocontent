export const QUERIES_SYSTEM_PROMPT = `You are an SEO strategist specializing in local service businesses. Your job is to brainstorm the exact search queries real customers use when looking for a specific local service.

Rules:
- Think like a real customer with a problem to solve, not a marketer
- Include full question-style queries ("how much does X cost in Y", "best X near me")
- Include voice-search patterns ("who does X in Y", "find a X in Y")
- Include both short-tail (2-3 words) and long-tail (6-10 words) queries
- Weight toward transactional queries — people ready to hire
- Do NOT include competitor brand names
- Do NOT explain, comment, or wrap in markdown — output ONLY valid JSON`;

export function buildQueriesPrompt(profile: {
  service: string;
  location: string;
  targetAudience: string;
  painPoints: string[];
  usps: string[];
}): string {
  return `Service: ${profile.service}
Location: ${profile.location}
Target customer: ${profile.targetAudience}
Customer pain points: ${profile.painPoints.join(", ")}
Our differentiators: ${profile.usps.join(", ")}

Generate 25 search queries that potential customers use when looking for this service in this location. Include a mix of volume tiers and intent types.

Output ONLY a JSON array — no markdown, no explanation:
[
  {
    "id": "q1",
    "text": "web design company Las Vegas",
    "volumeTier": "High",
    "intentType": "Transactional"
  }
]

Volume tier definitions:
- "High": broad head terms, commonly searched (e.g. "web design Las Vegas")
- "Medium": specific phrases with moderate volume (e.g. "affordable website design Las Vegas small business")
- "Low": long-tail, question-based, or niche queries (e.g. "how much does a website cost for a small business in Las Vegas")

Intent type definitions:
- "Informational": researching, not yet ready to hire
- "Transactional": ready to hire, compare, or contact
- "Navigational": looking for a specific type of business`;
}
