import { prisma } from "@/lib/db";
import { anthropic, makeSSEStream } from "@/lib/ai/stream";
import { DEEP_QUERY_SYSTEM_PROMPT, buildDeepArticlesPrompt } from "@/lib/ai/prompts/deep-query";

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

  if (!campaign.selectedTopicIds || !campaign.articleTopics || !campaign.mainPageApproved) {
    return new Response(
      JSON.stringify({ error: "Topics must be selected before generating articles" }),
      { status: 400 }
    );
  }

  const p = campaign.serviceProfile;
  const profile = {
    businessName: p.name,
    service: p.service,
    location: p.location,
    usps: JSON.parse(p.usps) as string[],
    toneNotes: p.toneNotes ?? undefined,
  };

  type Topic = { id: string; title: string; targetQuery: string; description: string };
  const allTopics = JSON.parse(campaign.articleTopics) as Topic[];
  const selectedIds = JSON.parse(campaign.selectedTopicIds) as string[];
  const selectedTopics = allTopics.filter((t) => selectedIds.includes(t.id));

  return makeSSEStream(
    () =>
      anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        system: DEEP_QUERY_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: buildDeepArticlesPrompt(profile, selectedTopics) },
        ],
      }),
    async (fullText) => {
      const start = fullText.indexOf("[");
      const end = fullText.lastIndexOf("]");
      if (start === -1 || end === -1) throw new Error("No JSON array in response");
      const articles = JSON.parse(fullText.slice(start, end + 1));
      await prisma.campaign.update({
        where: { id },
        data: {
          generatedArticles: JSON.stringify(articles),
          state: "ARTICLES_GENERATED",
        },
      });
    }
  );
}
