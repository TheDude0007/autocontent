import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySection = z.object({
  heading: z.string().min(1),
  content: z.string().min(1),
});

const faqItem = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

const approveSchema = z.object({
  heroIntro: z.string().min(1),
  bodySections: z.array(bodySection).min(1).max(6),
  faq: z.array(faqItem).min(3).max(15),
  cta: z.string().min(1),
  metaTitle: z.string().min(1).max(70),
  metaDescription: z.string().min(1).max(165),
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
      mainPageApproved: JSON.stringify(parsed.data),
      state: "PAGE_APPROVED",
    },
  });

  return NextResponse.json({ state: campaign.state });
}
