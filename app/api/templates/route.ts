import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1),
  pageType: z.enum(["SERVICE_PAGE", "ARTICLE", "LANDING_PAGE"]),
});

const SERVICE_PAGE_DEFAULTS = [
  { variableName: "heroIntro", acfFieldName: "hero_intro", contentType: "TEXT" as const, required: true, order: 0 },
  { variableName: "bodySection1Heading", acfFieldName: "body_1_heading", contentType: "HEADING" as const, required: true, order: 1 },
  { variableName: "bodySection1Content", acfFieldName: "body_1_content", contentType: "TEXT" as const, required: true, order: 2 },
  { variableName: "bodySection2Heading", acfFieldName: "body_2_heading", contentType: "HEADING" as const, required: false, order: 3 },
  { variableName: "bodySection2Content", acfFieldName: "body_2_content", contentType: "TEXT" as const, required: false, order: 4 },
  { variableName: "bodySection3Heading", acfFieldName: "body_3_heading", contentType: "HEADING" as const, required: false, order: 5 },
  { variableName: "bodySection3Content", acfFieldName: "body_3_content", contentType: "TEXT" as const, required: false, order: 6 },
  { variableName: "faqJson", acfFieldName: "faq_items", contentType: "FAQ" as const, required: false, order: 7 },
  { variableName: "ctaText", acfFieldName: "cta_text", contentType: "CTA" as const, required: true, order: 8 },
  { variableName: "metaTitle", acfFieldName: "_yoast_wpseo_title", contentType: "META_TITLE" as const, required: true, order: 9 },
  { variableName: "metaDescription", acfFieldName: "_yoast_wpseo_metadesc", contentType: "META_DESCRIPTION" as const, required: true, order: 10 },
];

const ARTICLE_DEFAULTS = [
  { variableName: "intro", acfFieldName: "article_intro", contentType: "TEXT" as const, required: true, order: 0 },
  { variableName: "section1Heading", acfFieldName: "section_1_heading", contentType: "HEADING" as const, required: true, order: 1 },
  { variableName: "section1Content", acfFieldName: "section_1_content", contentType: "TEXT" as const, required: true, order: 2 },
  { variableName: "section2Heading", acfFieldName: "section_2_heading", contentType: "HEADING" as const, required: false, order: 3 },
  { variableName: "section2Content", acfFieldName: "section_2_content", contentType: "TEXT" as const, required: false, order: 4 },
  { variableName: "section3Heading", acfFieldName: "section_3_heading", contentType: "HEADING" as const, required: false, order: 5 },
  { variableName: "section3Content", acfFieldName: "section_3_content", contentType: "TEXT" as const, required: false, order: 6 },
  { variableName: "faqJson", acfFieldName: "faq_items", contentType: "FAQ" as const, required: false, order: 7 },
  { variableName: "conclusion", acfFieldName: "article_conclusion", contentType: "TEXT" as const, required: true, order: 8 },
  { variableName: "internalLink", acfFieldName: "internal_link_suggestion", contentType: "TEXT" as const, required: false, order: 9 },
  { variableName: "metaTitle", acfFieldName: "_yoast_wpseo_title", contentType: "META_TITLE" as const, required: true, order: 10 },
  { variableName: "metaDescription", acfFieldName: "_yoast_wpseo_metadesc", contentType: "META_DESCRIPTION" as const, required: true, order: 11 },
];

export async function GET() {
  const templates = await prisma.template.findMany({
    include: { blocks: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const defaults =
    parsed.data.pageType === "SERVICE_PAGE"
      ? SERVICE_PAGE_DEFAULTS
      : parsed.data.pageType === "ARTICLE"
      ? ARTICLE_DEFAULTS
      : [];

  const template = await prisma.template.create({
    data: {
      name: parsed.data.name,
      pageType: parsed.data.pageType,
      blocks: { create: defaults },
    },
    include: { blocks: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(template, { status: 201 });
}
