import { prisma } from "@/lib/db";
import { anthropic, makeSSEStream } from "@/lib/ai/stream";
import { ARTICLES_SYSTEM_PROMPT, buildArticlesPrompt } from "@/lib/ai/prompts/articles";

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
    service: p.service,
    location: p.location,
    targetAudience: p.targetAudience,
    usps: JSON.parse(p.usps) as string[],
  };

  type Topic = { id: string; title: string; targetQuery: string; description: string };
  const allTopics = JSON.parse(campaign.articleTopics) as Topic[];
  const selectedIds = JSON.parse(campaign.selectedTopicIds) as string[];
  const selectedTopics = allTopics.filter((t) => selectedIds.includes(t.id));

  type PageApproved = { metaTitle?: string; heroIntro?: string };
  const page = JSON.parse(campaign.mainPageApproved) as PageApproved;
  const pageTitle = page.metaTitle || `${profile.service} in ${profile.location}`;

  return makeSSEStream(
    () =>
      anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        system: ARTICLES_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: buildArticlesPrompt(profile, selectedTopics, pageTitle) },
        ],
      }),
    async (fullText) => {
      const jsonText = extractJSONArray(fullText);
      const articles = JSON.parse(jsonText);
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

function extractJSONArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found in response");
  return text.slice(start, end + 1);
}
