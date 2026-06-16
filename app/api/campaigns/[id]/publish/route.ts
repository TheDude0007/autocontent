import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { createWPDraft, writeACFFields, writeYoastMeta } from "@/lib/wordpress";

const publishSchema = z.object({
  wpSiteId: z.string().min(1),
  pageTemplateId: z.string().optional(),
  articleTemplateId: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

type ServicePage = {
  heroIntro: string;
  bodySections: { heading: string; content: string }[];
  faq: { question: string; answer: string }[];
  cta: string;
  metaTitle: string;
  metaDescription: string;
};

type Article = {
  topicId: string;
  title: string;
  intro: string;
  sections: { heading: string; content: string }[];
  faq: { question: string; answer: string }[];
  conclusion: string;
  internalLinkSuggestion: string;
  metaTitle: string;
  metaDescription: string;
};

type TemplateBlock = { variableName: string; acfFieldName: string };

function buildPageFields(page: ServicePage, blocks?: TemplateBlock[]): Record<string, string> {
  const fieldFor = (varName: string, defaultField: string) =>
    blocks?.find((b) => b.variableName === varName)?.acfFieldName ?? defaultField;

  const fields: Record<string, string> = {
    [fieldFor("heroIntro", "hero_intro")]: page.heroIntro,
    [fieldFor("ctaText", "cta_text")]: page.cta,
  };

  page.bodySections.forEach((s, i) => {
    const n = i + 1;
    fields[fieldFor(`bodySection${n}Heading`, `body_${n}_heading`)] = s.heading;
    fields[fieldFor(`bodySection${n}Content`, `body_${n}_content`)] = s.content;
  });

  fields[fieldFor("faqJson", "faq_items")] = JSON.stringify(page.faq);

  return fields;
}

function buildArticleFields(article: Article, blocks?: TemplateBlock[]): Record<string, string> {
  const fieldFor = (varName: string, defaultField: string) =>
    blocks?.find((b) => b.variableName === varName)?.acfFieldName ?? defaultField;

  const fields: Record<string, string> = {
    [fieldFor("intro", "article_intro")]: article.intro,
    [fieldFor("conclusion", "article_conclusion")]: article.conclusion,
    [fieldFor("internalLink", "internal_link_suggestion")]: article.internalLinkSuggestion,
    [fieldFor("faqJson", "faq_items")]: JSON.stringify(article.faq),
  };

  article.sections.forEach((s, i) => {
    const n = i + 1;
    fields[fieldFor(`section${n}Heading`, `section_${n}_heading`)] = s.heading;
    fields[fieldFor(`section${n}Content`, `section_${n}_content`)] = s.content;
  });

  return fields;
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { wpSiteId, pageTemplateId, articleTemplateId } = parsed.data;

  const [campaign, wpSite] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id },
      include: { serviceProfile: true },
    }),
    prisma.wPSite.findUnique({ where: { id: wpSiteId } }),
  ]);

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (!wpSite) return NextResponse.json({ error: "WP site not found" }, { status: 404 });
  if (!campaign.mainPageApproved) {
    return NextResponse.json({ error: "Page not approved" }, { status: 400 });
  }

  const siteConfig = {
    url: wpSite.url,
    username: wpSite.username,
    appPassword: decrypt(wpSite.appPasswordEncrypted, wpSite.iv),
  };

  // Load templates if selected
  const [pageTemplate, articleTemplate] = await Promise.all([
    pageTemplateId
      ? prisma.template.findUnique({
          where: { id: pageTemplateId },
          include: { blocks: true },
        })
      : null,
    articleTemplateId
      ? prisma.template.findUnique({
          where: { id: articleTemplateId },
          include: { blocks: true },
        })
      : null,
  ]);

  const page = JSON.parse(campaign.mainPageApproved) as ServicePage;
  const articles: Article[] = campaign.generatedArticles
    ? (JSON.parse(campaign.generatedArticles) as Article[])
    : [];

  const results: {
    page: { id: number; editUrl: string; link: string };
    articles: { title: string; id: number; editUrl: string; link: string }[];
  } = { page: { id: 0, editUrl: "", link: "" }, articles: [] };

  // Push service page
  const pageTitle =
    page.bodySections[0]?.heading ||
    `${campaign.serviceProfile.service} — ${campaign.serviceProfile.location}`;

  const wpPage = await createWPDraft(siteConfig, {
    title: pageTitle,
    content: page.heroIntro,
    type: "page",
  });

  const pageFields = buildPageFields(page, pageTemplate?.blocks);
  await writeACFFields(siteConfig, wpPage.id, "pages", pageFields);
  await writeYoastMeta(siteConfig, wpPage.id, "pages", {
    title: page.metaTitle,
    description: page.metaDescription,
  });

  results.page = wpPage;

  // Push articles
  const articleWpIds: number[] = [];
  for (const article of articles) {
    const wpPost = await createWPDraft(siteConfig, {
      title: article.title,
      content: article.intro,
      type: "post",
    });
    const articleFields = buildArticleFields(article, articleTemplate?.blocks);
    await writeACFFields(siteConfig, wpPost.id, "posts", articleFields);
    await writeYoastMeta(siteConfig, wpPost.id, "posts", {
      title: article.metaTitle,
      description: article.metaDescription,
    });
    articleWpIds.push(wpPost.id);
    results.articles.push({ title: article.title, ...wpPost });
  }

  // Advance campaign to COMPLETE
  await prisma.campaign.update({
    where: { id },
    data: {
      wpSiteId,
      wpPageDraftId: wpPage.id,
      wpArticleDraftIds: JSON.stringify(articleWpIds),
      state: "COMPLETE",
    },
  });

  return NextResponse.json(results);
}
