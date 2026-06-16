"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { toast } from "sonner";

type Site = { id: string; name: string; url: string; username: string };
type Template = { id: string; name: string; pageType: string };

type ServicePage = {
  heroIntro: string;
  bodySections: { heading: string; content: string }[];
  faq: { question: string; answer: string }[];
  cta: string;
  metaTitle: string;
  metaDescription: string;
};

type Article = { topicId: string; title: string; metaTitle: string };

type Campaign = {
  id: string;
  state: string;
  mainPageApproved: string | null;
  generatedArticles: string | null;
  wpPageDraftId: number | null;
  wpArticleDraftIds: string | null;
  wpSiteId: string | null;
  serviceProfile: { name: string; service: string; location: string };
};

type PushResult = {
  page: { id: number; editUrl: string; link: string };
  articles: { title: string; id: number; editUrl: string; link: string }[];
};

type Params = { params: Promise<{ id: string }> };

export default function PublishPage({ params }: Params) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [pageTemplateId, setPageTemplateId] = useState("");
  const [articleTemplateId, setArticleTemplateId] = useState("");
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/campaigns/${id}`).then((r) => r.json()),
      fetch("/api/sites").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
    ]).then(([c, s, t]) => {
      setCampaign(c);
      setSites(s);
      setTemplates(t);
      if (c.wpSiteId) setSelectedSiteId(c.wpSiteId);
      // Pre-select if only one site
      if (s.length === 1) setSelectedSiteId(s[0].id);
    });
  }, [id]);

  if (!campaign) {
    return <p className="text-sm text-gray-400 py-8">Loading...</p>;
  }

  const isComplete = campaign.state === "COMPLETE";
  const page: ServicePage | null = campaign.mainPageApproved
    ? JSON.parse(campaign.mainPageApproved)
    : null;
  const articles: Article[] = campaign.generatedArticles
    ? JSON.parse(campaign.generatedArticles)
    : [];

  const pageTemplates = templates.filter((t) => t.pageType === "SERVICE_PAGE");
  const articleTemplates = templates.filter((t) => t.pageType === "ARTICLE");

  async function push() {
    if (!selectedSiteId) {
      toast.error("Select a WordPress site");
      return;
    }
    setPushing(true);
    const res = await fetch(`/api/campaigns/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wpSiteId: selectedSiteId,
        pageTemplateId: pageTemplateId || undefined,
        articleTemplateId: articleTemplateId || undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json() as PushResult;
      setResult(data);
      toast.success("Pushed to WordPress as drafts");
    } else {
      const err = await res.json().catch(() => ({})) as { error?: string; message?: string };
      toast.error(err.error || err.message || "Push failed");
    }
    setPushing(false);
  }

  async function exportJSON() {
    if (!page || !campaign) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            campaign: { id, service: campaign.serviceProfile.service, location: campaign.serviceProfile.location },
            page,
            articles,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign-${id.slice(-6)}-content.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 mb-3 inline-block">
          ← Dashboard
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Publish to WordPress</h1>
            <p className="text-sm text-gray-500 mt-1">
              {campaign.serviceProfile.name} · {campaign.serviceProfile.service} ·{" "}
              {campaign.serviceProfile.location}
            </p>
          </div>
          <div className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
            Step 5 of 5
          </div>
        </div>
      </div>

      {/* Content summary */}
      {page && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Content to Push
          </p>
          <div className="space-y-2">
            <ContentRow
              label="Service Page"
              value={page.metaTitle || page.bodySections[0]?.heading || "Untitled"}
              sub={`${page.bodySections.length} sections · ${page.faq.length} FAQs`}
            />
            {articles.map((a, i) => (
              <ContentRow
                key={a.topicId}
                label={`Article ${i + 1}`}
                value={a.title}
                sub={a.metaTitle}
              />
            ))}
          </div>
        </div>
      )}

      {/* Already published — show links */}
      {isComplete && (result || campaign.wpPageDraftId) ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
          <p className="text-sm font-semibold text-green-800 mb-4">
            ✓ Pushed to WordPress as drafts
          </p>
          {result && (
            <div className="space-y-2">
              <ResultLink label="Service Page" editUrl={result.page.editUrl} link={result.page.link} />
              {result.articles.map((a, i) => (
                <ResultLink key={i} label={a.title} editUrl={a.editUrl} link={a.link} />
              ))}
            </div>
          )}
          {!result && campaign.wpPageDraftId && (
            <p className="text-sm text-green-700">
              Page draft ID: <strong>{campaign.wpPageDraftId}</strong>. Open WordPress admin to review.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Site + template selection */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 space-y-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Publishing Options
            </p>

            {/* WP Site */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                WordPress Site
              </label>
              {sites.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No sites configured.{" "}
                  <Link href="/settings" className="underline text-gray-900">
                    Add one in Settings →
                  </Link>
                </p>
              ) : (
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 w-full max-w-sm"
                >
                  <option value="">Select a site...</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.url}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Page template */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Page Template{" "}
                  <span className="text-gray-400 font-normal text-xs">(optional)</span>
                </label>
                <select
                  value={pageTemplateId}
                  onChange={(e) => setPageTemplateId(e.target.value)}
                  className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 w-full"
                >
                  <option value="">Default field names</option>
                  {pageTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              {articles.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Article Template{" "}
                    <span className="text-gray-400 font-normal text-xs">(optional)</span>
                  </label>
                  <select
                    value={articleTemplateId}
                    onChange={(e) => setArticleTemplateId(e.target.value)}
                    className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 w-full"
                  >
                    <option value="">Default field names</option>
                    {articleTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-4 pb-8">
            <button
              onClick={push}
              disabled={pushing || !selectedSiteId || sites.length === 0}
              className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {pushing
                ? "Pushing to WordPress..."
                : `Push ${1 + articles.length} draft${articles.length !== 0 ? "s" : ""} to WordPress`}
            </button>
            <button
              onClick={exportJSON}
              className="px-5 py-2.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-md hover:border-gray-400 hover:text-gray-900 transition-colors"
            >
              Export JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ContentRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs font-medium text-gray-400 w-28 flex-shrink-0">{label}</span>
      <div>
        <p className="text-sm text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

function ResultLink({
  label,
  editUrl,
  link,
}: {
  label: string;
  editUrl: string;
  link: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-green-100 last:border-0">
      <span className="text-sm text-green-800">{label}</span>
      <div className="flex gap-3">
        <a
          href={editUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-green-700 underline"
        >
          Edit in WP Admin
        </a>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-green-700 underline"
        >
          Preview
        </a>
      </div>
    </div>
  );
}
