import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { TopicsClient } from "./topics-client";

export type Topic = {
  id: string;
  title: string;
  targetQuery: string;
  value: "High" | "Medium";
  description: string;
};

type Params = { params: Promise<{ id: string }> };

export default async function TopicsPage({ params }: Params) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      serviceProfile: { select: { name: true, service: true, location: true } },
    },
  });

  if (!campaign) notFound();

  // Not ready — go back
  if (
    campaign.state === "INPUT_COMPLETE" ||
    campaign.state === "QUERIES_GENERATED" ||
    campaign.state === "QUERIES_APPROVED" ||
    campaign.state === "PAGE_GENERATED"
  ) {
    redirect(`/campaigns/${id}/page`);
  }

  // Already past topics — move forward
  if (
    campaign.state === "ARTICLES_GENERATED" ||
    campaign.state === "OUTPUT_FORMATTED" ||
    campaign.state === "WP_PUSHED" ||
    campaign.state === "COMPLETE"
  ) {
    redirect(`/campaigns/${id}/articles`);
  }

  const topics: Topic[] = campaign.articleTopics
    ? (JSON.parse(campaign.articleTopics) as Topic[])
    : [];

  const selectedIds: string[] = campaign.selectedTopicIds
    ? (JSON.parse(campaign.selectedTopicIds) as string[])
    : [];

  return (
    <TopicsClient
      campaignId={id}
      profileName={campaign.serviceProfile.name}
      service={campaign.serviceProfile.service}
      location={campaign.serviceProfile.location}
      initialTopics={topics}
      initialSelectedIds={selectedIds}
      alreadyGenerated={
        campaign.state === "TOPICS_GENERATED" || campaign.state === "ARTICLES_SELECTED"
      }
      alreadySelected={campaign.state === "ARTICLES_SELECTED"}
    />
  );
}
