import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const sectionSchema = z.object({
  heading: z.string().min(1),
  content: z.string().min(1),
});

const faqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

const articleSchema = z.object({
  topicId: z.string(),
  title: z.string().min(1),
  intro: z.string().min(1),
  sections: z.array(sectionSchema).min(1),
  faq: z.array(faqSchema).min(1),
  conclusion: z.string().min(1),
  internalLinkSuggestion: z.string(),
  metaTitle: z.string().max(70),
  metaDescription: z.string().max(165),
});

const approveSchema = z.object({
  articles: z.array(articleSchema).min(1),
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
      generatedArticles: JSON.stringify(parsed.data.articles),
      state: "OUTPUT_FORMATTED",
    },
  });

  return NextResponse.json({ state: campaign.state });
}
