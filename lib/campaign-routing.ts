import { CampaignState } from "@/app/generated/prisma/enums";

export function getCampaignStepRoute(id: string, state: CampaignState): string {
  const routes: Record<CampaignState, string> = {
    INPUT_COMPLETE: `/campaigns/${id}/queries`,
    QUERIES_GENERATED: `/campaigns/${id}/queries`,
    QUERIES_APPROVED: `/campaigns/${id}/page`,
    PAGE_GENERATED: `/campaigns/${id}/page`,
    PAGE_APPROVED: `/campaigns/${id}/topics`,
    TOPICS_GENERATED: `/campaigns/${id}/topics`,
    ARTICLES_SELECTED: `/campaigns/${id}/articles`,
    ARTICLES_GENERATED: `/campaigns/${id}/articles`,
    OUTPUT_FORMATTED: `/campaigns/${id}/publish`,
    WP_PUSHED: `/campaigns/${id}/publish`,
    COMPLETE: `/campaigns/${id}/publish`,
  };
  return routes[state];
}

export function getCampaignStateLabel(state: CampaignState): string {
  const labels: Record<CampaignState, string> = {
    INPUT_COMPLETE: "Ready for Query Research",
    QUERIES_GENERATED: "Queries Awaiting Approval",
    QUERIES_APPROVED: "Ready for Page Generation",
    PAGE_GENERATED: "Page Awaiting Approval",
    PAGE_APPROVED: "Ready for Article Planning",
    TOPICS_GENERATED: "Topics Awaiting Selection",
    ARTICLES_SELECTED: "Ready for Article Generation",
    ARTICLES_GENERATED: "Articles Awaiting Review",
    OUTPUT_FORMATTED: "Ready to Publish",
    WP_PUSHED: "Pushed to WordPress",
    COMPLETE: "Complete",
  };
  return labels[state];
}

export function getCampaignStateBadgeColor(state: CampaignState): string {
  const colors: Record<CampaignState, string> = {
    INPUT_COMPLETE: "bg-gray-100 text-gray-600",
    QUERIES_GENERATED: "bg-amber-100 text-amber-700",
    QUERIES_APPROVED: "bg-gray-100 text-gray-600",
    PAGE_GENERATED: "bg-amber-100 text-amber-700",
    PAGE_APPROVED: "bg-gray-100 text-gray-600",
    TOPICS_GENERATED: "bg-amber-100 text-amber-700",
    ARTICLES_SELECTED: "bg-gray-100 text-gray-600",
    ARTICLES_GENERATED: "bg-amber-100 text-amber-700",
    OUTPUT_FORMATTED: "bg-blue-100 text-blue-700",
    WP_PUSHED: "bg-green-100 text-green-700",
    COMPLETE: "bg-green-100 text-green-700",
  };
  return colors[state];
}
