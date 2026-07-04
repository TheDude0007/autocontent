import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { createWPDraft, writeYoastMeta } from "@/lib/wordpress";
import type { DeepQueryResult } from "@/lib/ai/prompts/deep-query";

function buildHTML(result: DeepQueryResult): string {
  const sections = (result.semanticFacets ?? []).map((f) => {
    const subHTML = (f.subSections ?? [])
      .map((s) => `<h3>${s.heading}</h3><p>${s.content}</p>`)
      .join("\n");
    const faqHTML = (f.faq ?? [])
      .map((q) => `<p><strong>Q: ${q.question}</strong></p><p>${q.answer}</p>`)
      .join("\n");
    const mediaBrief = f.mediaBrief ? `<!-- Media brief: ${f.mediaBrief} -->` : "";
    return `<h2>${f.heading}</h2>\n${mediaBrief}\n<p>${f.content.replace(/\n/g, "</p><p>")}</p>\n${subHTML}${faqHTML ? `\n<h4>FAQ</h4>\n${faqHTML}` : ""}`;
  }).join("\n\n");

  const masterFAQ = (result.masterFAQ ?? [])
    .map((q) => `<p><strong>Q: ${q.question}</strong></p><p>${q.answer}</p>`)
    .join("\n");

  return [
    `<p>${result.introduction.replace(/\n/g, "</p><p>")}</p>`,
    sections,
    masterFAQ ? `<h2>Frequently Asked Questions</h2>\n${masterFAQ}` : "",
    result.conclusion ? `<p>${result.conclusion.replace(/\n/g, "</p><p>")}</p>` : "",
    result.cta ? `<p><strong>${result.cta}</strong></p>` : "",
  ].filter(Boolean).join("\n\n");
}

export async function POST(req: Request) {
  const { wpSiteId, result } = await req.json() as { wpSiteId: string; result: DeepQueryResult };

  if (!wpSiteId || !result) {
    return NextResponse.json({ error: "wpSiteId and result are required" }, { status: 400 });
  }

  const wpSite = await prisma.wPSite.findUnique({ where: { id: wpSiteId } });
  if (!wpSite) return NextResponse.json({ error: "WP site not found" }, { status: 404 });

  const siteConfig = {
    url: wpSite.url,
    username: wpSite.username,
    appPassword: decrypt(wpSite.appPasswordEncrypted, wpSite.iv),
  };

  const wpPage = await createWPDraft(siteConfig, {
    title: result.pageH1,
    content: buildHTML(result),
    type: "page",
  });

  await writeYoastMeta(siteConfig, wpPage.id, "pages", {
    title: result.metaTitle,
    description: result.metaDescription,
  });

  return NextResponse.json({ id: wpPage.id, editUrl: wpPage.editUrl, link: wpPage.link });
}
