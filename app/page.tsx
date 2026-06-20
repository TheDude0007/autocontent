import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  getCampaignStepRoute,
  getCampaignStateLabel,
  getCampaignStateBadgeColor,
} from "@/lib/campaign-routing";
import { CampaignState } from "@/app/generated/prisma/enums";

async function getCampaigns() {
  noStore();
  return prisma.campaign.findMany({
    include: {
      serviceProfile: { select: { name: true, service: true, location: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export default async function DashboardPage() {
  const campaigns = await getCampaigns();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">
            Each campaign generates a service page + article cluster for one client service.
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
        >
          + New Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="text-4xl mb-3">◈</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No campaigns yet</h2>
          <p className="text-sm text-gray-500 mb-6">
            Start by creating a service profile, then launch a campaign.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/profiles"
              className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Create a Profile
            </Link>
            <Link
              href="/campaigns/new"
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700"
            >
              New Campaign
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const resumeHref = getCampaignStepRoute(c.id, c.state as CampaignState);
            const stateLabel = getCampaignStateLabel(c.state as CampaignState);
            const badgeColor = getCampaignStateBadgeColor(c.state as CampaignState);
            return (
              <div
                key={c.id}
                className="bg-white border border-gray-200 rounded-xl px-6 py-4 flex items-center justify-between hover:border-gray-300 transition-colors"
              >
                <div>
                  <div className="font-semibold text-gray-900 text-sm">
                    {c.serviceProfile.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {c.serviceProfile.service} · {c.serviceProfile.location}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}
                  >
                    {stateLabel}
                  </span>
                  <div className="text-xs text-gray-400">
                    {new Date(c.updatedAt).toLocaleDateString()}
                  </div>
                  <Link
                    href={resumeHref}
                    className="text-sm font-medium text-gray-900 hover:underline"
                  >
                    Resume →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
