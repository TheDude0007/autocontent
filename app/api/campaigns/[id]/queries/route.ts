import { prisma } from "@/lib/db";
import { anthropic, makeSSEStream } from "@/lib/ai/stream";
import { QUERIES_SYSTEM_PROMPT, buildQueriesPrompt } from "@/lib/ai/prompts/queries";

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

  const p = campaign.serviceProfile;
  const profile = {
    service: p.service,
    location: p.location,
    targetAudience: p.targetAudience,
    painPoints: JSON.parse(p.painPoints) as string[],
    usps: JSON.parse(p.usps) as string[],
  };

  return makeSSEStream(
    () =>
      anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 2500,
        system: QUERIES_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildQueriesPrompt(profile) }],
      }),
    async (fullText) => {
      const jsonText = extractJSON(fullText);
      const queries = JSON.parse(jsonText);
      await prisma.campaign.update({
        where: { id },
        data: {
          generatedQueries: JSON.stringify(queries),
          state: "QUERIES_GENERATED",
        },
      });
    }
  );
}

function extractJSON(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found in response");
  return text.slice(start, end + 1);
}
