import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { PageClient } from "./page-client";

type BodySection = { heading: string; content: string };
type FAQItem = { question: string; answer: string };
export type ServicePage = {
  heroIntro: string;
  bodySections: BodySection[];
  faq: FAQItem[];
  cta: string;
  metaTitle: string;
  metaDescription: string;
};

type Params = { params: Promise<{ id: string }> };

export default async function ServicePageRoute({ params }: Params) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      serviceProfile: {
        select: { name: true, service: true, location: true },
      },
    },
  });

  if (!campaign) notFound();

  // Not ready — go back
  if (
    campaign.state === "INPUT_COMPLETE" ||
    campaign.state === "QUERIES_GENERATED"
  ) {
    redirect(`/campaigns/${id}/queries`);
  }

  // Already done — move forward
  if (
    campaign.state === "PAGE_APPROVED" ||
    campaign.state === "TOPICS_GENERATED" ||
    campaign.state === "ARTICLES_SELECTED" ||
    campaign.state === "ARTICLES_GENERATED" ||
    campaign.state === "OUTPUT_FORMATTED" ||
    campaign.state === "WP_PUSHED" ||
    campaign.state === "COMPLETE"
  ) {
    redirect(`/campaigns/${id}/topics`);
  }

  const draft: ServicePage | null = campaign.mainPageDraft
    ? (JSON.parse(campaign.mainPageDraft) as ServicePage)
    : null;

  return (
    <PageClient
      campaignId={id}
      profileName={campaign.serviceProfile.name}
      service={campaign.serviceProfile.service}
      location={campaign.serviceProfile.location}
      initialDraft={draft}
      alreadyGenerated={campaign.state === "PAGE_GENERATED"}
    />
  );
}
