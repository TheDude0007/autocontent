import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { ArticlesClient } from "./articles-client";
import type { DeepQueryResult } from "@/lib/ai/prompts/deep-query";

// Article is a DeepQueryResult with a required topicId
export type Article = DeepQueryResult & { topicId: string };

type Params = { params: Promise<{ id: string }> };

export default async function ArticlesPage({ params }: Params) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      serviceProfile: { select: { name: true, service: true, location: true } },
    },
  });

  if (!campaign) notFound();

  if (
    campaign.state === "INPUT_COMPLETE" ||
    campaign.state === "QUERIES_GENERATED" ||
    campaign.state === "QUERIES_APPROVED" ||
    campaign.state === "PAGE_GENERATED" ||
    campaign.state === "PAGE_APPROVED" ||
    campaign.state === "TOPICS_GENERATED"
  ) {
    redirect(`/campaigns/${id}/topics`);
  }

  if (
    campaign.state === "OUTPUT_FORMATTED" ||
    campaign.state === "WP_PUSHED" ||
    campaign.state === "COMPLETE"
  ) {
    redirect(`/campaigns/${id}/publish`);
  }

  const articles: Article[] = campaign.generatedArticles
    ? (JSON.parse(campaign.generatedArticles) as Article[])
    : [];

  type Topic = { id: string; title: string };
  const allTopics: Topic[] = campaign.articleTopics
    ? (JSON.parse(campaign.articleTopics) as Topic[])
    : [];

  const selectedIds: string[] = campaign.selectedTopicIds
    ? (JSON.parse(campaign.selectedTopicIds) as string[])
    : [];

  const selectedTopics = allTopics.filter((t) => selectedIds.includes(t.id));

  return (
    <ArticlesClient
      campaignId={id}
      profileName={campaign.serviceProfile.name}
      service={campaign.serviceProfile.service}
      location={campaign.serviceProfile.location}
      selectedTopics={selectedTopics}
      initialArticles={articles}
      alreadyGenerated={campaign.state === "ARTICLES_GENERATED"}
    />
  );
}
