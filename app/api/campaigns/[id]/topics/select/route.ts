import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const selectSchema = z.object({
  topicIds: z.array(z.string()).min(1).max(5),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const parsed = selectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      selectedTopicIds: JSON.stringify(parsed.data.topicIds),
      state: "ARTICLES_SELECTED",
    },
  });

  return NextResponse.json({ state: campaign.state });
}
