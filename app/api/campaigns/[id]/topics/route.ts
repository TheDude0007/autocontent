import { prisma } from "@/lib/db";
import { anthropic, makeSSEStream } from "@/lib/ai/stream";
import { TOPICS_SYSTEM_PROMPT, buildTopicsPrompt } from "@/lib/ai/prompts/topics";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { serviceProfile: true },
  });

  if (!campaign) {
    return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404 });
  }

  if (!campaign.approvedQueries || !campaign.mainPageApproved) {
    return new Response(
      JSON.stringify({ error: "Page must be approved before generating topics" }),
      { status: 400 }
    );
  }

  const p = campaign.serviceProfile;
  const profile = {
    service: p.service,
    location: p.location,
    targetAudience: p.targetAudience,
  };

  type Query = { text: string; volumeTier: string; intentType: string };
  const queries = JSON.parse(campaign.approvedQueries) as Query[];

  type PageDraft = { heroIntro: string };
  const page = JSON.parse(campaign.mainPageApproved) as PageDraft;

  return makeSSEStream(
    () =>
      anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: TOPICS_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: buildTopicsPrompt(profile, queries, page.heroIntro) },
        ],
      }),
    async (fullText) => {
      const jsonText = extractJSONArray(fullText);
      const topics = JSON.parse(jsonText);
      await prisma.campaign.update({
        where: { id },
        data: {
          articleTopics: JSON.stringify(topics),
          state: "TOPICS_GENERATED",
        },
      });
    }
  );
}

function extractJSONArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found in response");
  return text.slice(start, end + 1);
}
