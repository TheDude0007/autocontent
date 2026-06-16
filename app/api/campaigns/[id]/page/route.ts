import { prisma } from "@/lib/db";
import { anthropic, makeSSEStream } from "@/lib/ai/stream";
import { SERVICE_PAGE_SYSTEM_PROMPT, buildServicePagePrompt } from "@/lib/ai/prompts/service-page";

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

  if (!campaign.approvedQueries) {
    return new Response(JSON.stringify({ error: "Queries not approved yet" }), { status: 400 });
  }

  const p = campaign.serviceProfile;
  const profile = {
    service: p.service,
    location: p.location,
    targetAudience: p.targetAudience,
    painPoints: JSON.parse(p.painPoints) as string[],
    usps: JSON.parse(p.usps) as string[],
    salesObjections: JSON.parse(p.salesObjections) as string[],
    toneNotes: p.toneNotes,
  };

  type Query = { id: string; text: string; volumeTier: string; intentType: string };
  const queries = JSON.parse(campaign.approvedQueries) as Query[];

  return makeSSEStream(
    () =>
      anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 4500,
        system: SERVICE_PAGE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildServicePagePrompt(profile, queries) }],
      }),
    async (fullText) => {
      const jsonText = extractJSON(fullText);
      const page = JSON.parse(jsonText);
      await prisma.campaign.update({
        where: { id },
        data: {
          mainPageDraft: JSON.stringify(page),
          state: "PAGE_GENERATED",
        },
      });
    }
  );
}

function extractJSON(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  return text.slice(start, end + 1);
}
