import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const querySchema = z.object({
  id: z.string(),
  text: z.string(),
  volumeTier: z.enum(["High", "Medium", "Low"]),
  intentType: z.enum(["Informational", "Transactional", "Navigational"]),
});

const approveSchema = z.object({
  queries: z.array(querySchema).min(1),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const parsed = approveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      approvedQueries: JSON.stringify(parsed.data.queries),
      state: "QUERIES_APPROVED",
    },
  });

  return NextResponse.json({ state: campaign.state });
}
