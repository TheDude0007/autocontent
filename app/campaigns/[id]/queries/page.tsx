import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { QueriesClient } from "./queries-client";

type Query = {
  id: string;
  text: string;
  volumeTier: "High" | "Medium" | "Low";
  intentType: "Informational" | "Transactional" | "Navigational";
};

type Params = { params: Promise<{ id: string }> };

export default async function QueriesPage({ params }: Params) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { serviceProfile: { select: { name: true, service: true, location: true } } },
  });

  if (!campaign) notFound();

  // Already approved — move forward
  if (campaign.state === "QUERIES_APPROVED" ||
      campaign.state === "PAGE_GENERATED" ||
      campaign.state === "PAGE_APPROVED" ||
      campaign.state === "TOPICS_GENERATED" ||
      campaign.state === "ARTICLES_SELECTED" ||
      campaign.state === "ARTICLES_GENERATED" ||
      campaign.state === "OUTPUT_FORMATTED" ||
      campaign.state === "WP_PUSHED" ||
      campaign.state === "COMPLETE") {
    redirect(`/campaigns/${id}/page`);
  }

  const generatedQueries: Query[] = campaign.generatedQueries
    ? (JSON.parse(campaign.generatedQueries) as Query[])
    : [];

  return (
    <QueriesClient
      campaignId={id}
      profileName={campaign.serviceProfile.name}
      service={campaign.serviceProfile.service}
      location={campaign.serviceProfile.location}
      initialQueries={generatedQueries}
      alreadyGenerated={campaign.state === "QUERIES_GENERATED"}
    />
  );
}
