"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { Article } from "./page";
import type { DeepFacet, DeepFAQ } from "@/lib/ai/prompts/deep-query";

type Topic = { id: string; title: string };

type Props = {
  campaignId: string;
  profileName: string;
  service: string;
  location: string;
  selectedTopics: Topic[];
  initialArticles: Article[];
  alreadyGenerated: boolean;
};

const ta = "w-full text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-colors";
const inp = "w-full text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-colors";

function Label({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="mb-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{text}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export function ArticlesClient({
  campaignId,
  profileName,
  service,
  location,
  selectedTopics,
  initialArticles,
  alreadyGenerated,
}: Props) {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [streaming, setStreaming] = useState(false);
  const [streamPreview, setStreamPreview] = useState("");
  const [generated, setGenerated] = useState(alreadyGenerated || initialArticles.length > 0);
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);
  const [openFacetId, setOpenFacetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const streamRef = useRef<AbortController | null>(null);

  async function generate() {
    setStreaming(true);
    setStreamPreview("");
    streamRef.current = new AbortController();

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/articles`, {
        method: "POST",
        signal: streamRef.current.signal,
      });

      if (!res.ok || !res.body) {
        toast.error("Failed to start generation");
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);

          if (data === "[DONE]") {
            const updated = await fetch(`/api/campaigns/${campaignId}`);
            const campaign = await updated.json();
            if (campaign.generatedArticles) {
              const parsed = JSON.parse(campaign.generatedArticles) as Article[];
              setArticles(parsed);
              if (parsed.length > 0) setOpenArticleId(parsed[0].topicId);
            }
            setGenerated(true);
            setStreaming(false);
            setStreamPreview("");
            return;
          }

          const parsed = JSON.parse(data);
          if (parsed.error) { toast.error(parsed.error); setStreaming(false); return; }
          if (parsed.text) setStreamPreview((p) => p + parsed.text);
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error("Generation failed");
      setStreaming(false);
    }
  }

  function updateArticle(topicId: string, updater: (a: Article) => Article) {
    setArticles((prev) => prev.map((a) => (a.topicId === topicId ? updater(a) : a)));
  }

  function updateFacet(topicId: string, facetId: string, updater: (f: DeepFacet) => DeepFacet) {
    updateArticle(topicId, (a) => ({
      ...a,
      semanticFacets: a.semanticFacets.map((f) => (f.id === facetId ? updater(f) : f)),
    }));
  }

  function updateFacetFAQ(topicId: string, facetId: string, fi: number, updater: (q: DeepFAQ) => DeepFAQ) {
    updateFacet(topicId, facetId, (f) => {
      const faq = [...f.faq];
      faq[fi] = updater(faq[fi]);
      return { ...f, faq };
    });
  }

  function updateMasterFAQ(topicId: string, fi: number, updater: (q: DeepFAQ) => DeepFAQ) {
    updateArticle(topicId, (a) => {
      const masterFAQ = [...a.masterFAQ];
      masterFAQ[fi] = updater(masterFAQ[fi]);
      return { ...a, masterFAQ };
    });
  }

  async function approveAll() {
    if (articles.length === 0) return;
    setSaving(true);
    const res = await fetch(`/api/campaigns/${campaignId}/articles/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articles }),
    });
    if (res.ok) {
      toast.success("Articles approved — ready to publish");
      router.push(`/campaigns/${campaignId}/publish`);
    } else {
      toast.error("Approval failed");
      setSaving(false);
    }
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
            <h1 className="text-2xl font-bold text-gray-900">Article Generation</h1>
            <p className="text-sm text-gray-500 mt-1">{profileName} · {service} · {location}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full font-medium">Deep Query</span>
            <div className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">Step 4 of 5</div>
          </div>
        </div>
      </div>

      {/* Generate */}
      {!generated && !streaming && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center mb-6">
          <div className="text-3xl mb-3">◈</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Generate {selectedTopics.length} deep content package{selectedTopics.length !== 1 ? "s" : ""}
          </h2>
          <p className="text-xs text-gray-400 mb-3">Each article gets semantic facets · per-facet FAQ · media briefs · citation suggestions</p>
          <div className="text-sm text-gray-500 mb-6 max-w-md mx-auto space-y-1">
            {selectedTopics.map((t) => (<p key={t.id} className="text-gray-600">· {t.title}</p>))}
          </div>
          <button onClick={generate} className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors">
            Generate Articles
          </button>
        </div>
      )}

      {/* Streaming */}
      {streaming && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-700">Building deep content packages...</span>
          </div>
          <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">{streamPreview}</pre>
        </div>
      )}

      {/* Article accordion editor */}
      {generated && !streaming && articles.length > 0 && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={generate} className="text-sm text-gray-500 hover:text-gray-900 font-medium">↺ Regenerate All</button>
          </div>

          <div className="space-y-3 mb-8">
            {articles.map((article, articleIdx) => {
              const isOpen = openArticleId === article.topicId;
              return (
                <div key={article.topicId} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* Accordion header */}
                  <button
                    onClick={() => { setOpenArticleId(isOpen ? null : article.topicId); setOpenFacetId(null); }}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Article {articleIdx + 1}</p>
                      <p className="text-sm font-semibold text-gray-900">{article.pageH1 || article.rootQuery}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{article.semanticFacets?.length ?? 0} facets · {article.masterFAQ?.length ?? 0} FAQs</p>
                    </div>
                    <span className="text-gray-400 text-sm ml-4">{isOpen ? "▲" : "▼"}</span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 divide-y divide-gray-100">

                      {/* Meta + H1 */}
                      <div className="px-6 py-5 space-y-4">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Page Meta</div>
                        <div>
                          <Label text="H1 Heading" />
                          <input type="text" value={article.pageH1} onChange={(e) => updateArticle(article.topicId, (a) => ({ ...a, pageH1: e.target.value }))} className={inp} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="flex justify-between mb-1">
                              <Label text="Meta Title" />
                              <span className={`text-xs ${article.metaTitle.length > 60 ? "text-red-500" : "text-gray-400"}`}>{article.metaTitle.length}/60</span>
                            </div>
                            <input type="text" value={article.metaTitle} onChange={(e) => updateArticle(article.topicId, (a) => ({ ...a, metaTitle: e.target.value }))} className={inp} />
                          </div>
                          <div>
                            <div className="flex justify-between mb-1">
                              <Label text="Meta Description" />
                              <span className={`text-xs ${article.metaDescription.length > 155 ? "text-red-500" : "text-gray-400"}`}>{article.metaDescription.length}/155</span>
                            </div>
                            <input type="text" value={article.metaDescription} onChange={(e) => updateArticle(article.topicId, (a) => ({ ...a, metaDescription: e.target.value }))} className={inp} />
                          </div>
                        </div>
                      </div>

                      {/* Introduction */}
                      <div className="px-6 py-5">
                        <Label text="Introduction" />
                        <textarea value={article.introduction} onChange={(e) => updateArticle(article.topicId, (a) => ({ ...a, introduction: e.target.value }))} rows={4} className={ta} />
                      </div>

                      {/* Semantic Facets */}
                      <div className="px-6 py-5">
                        <div className="flex items-center justify-between mb-3">
                          <Label text={`${article.semanticFacets?.length ?? 0} Semantic Facets`} sub="Click a facet to edit its content, FAQ, and media brief" />
                        </div>
                        <div className="space-y-2">
                          {article.semanticFacets?.map((facet) => {
                            const isFacetOpen = openFacetId === `${article.topicId}-${facet.id}`;
                            return (
                              <div key={facet.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                <button
                                  onClick={() => setOpenFacetId(isFacetOpen ? null : `${article.topicId}-${facet.id}`)}
                                  className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                                >
                                  <span className="text-sm font-medium text-gray-900">{facet.heading}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">{facet.faq?.length ?? 0} FAQs · {facet.citationSuggestions?.length ?? 0} citations</span>
                                    <span className="text-gray-400 text-xs">{isFacetOpen ? "▲" : "▼"}</span>
                                  </div>
                                </button>
                                {isFacetOpen && (
                                  <div className="px-4 py-4 space-y-4 bg-white">
                                    {/* Facet heading */}
                                    <div>
                                      <Label text="H2 Heading" />
                                      <input type="text" value={facet.heading} onChange={(e) => updateFacet(article.topicId, facet.id, (f) => ({ ...f, heading: e.target.value }))} className={inp} />
                                    </div>
                                    {/* Facet content */}
                                    <div>
                                      <Label text="Section Content" />
                                      <textarea value={facet.content} onChange={(e) => updateFacet(article.topicId, facet.id, (f) => ({ ...f, content: e.target.value }))} rows={6} className={ta} />
                                    </div>
                                    {/* Facet FAQ */}
                                    {facet.faq?.length > 0 && (
                                      <div>
                                        <Label text="Section FAQ" />
                                        <div className="space-y-2">
                                          {facet.faq.map((q, fi) => (
                                            <div key={fi} className="bg-gray-50 rounded-lg p-3 space-y-2">
                                              <input type="text" value={q.question} onChange={(e) => updateFacetFAQ(article.topicId, facet.id, fi, (fq) => ({ ...fq, question: e.target.value }))} placeholder="Question" className={inp} />
                                              <textarea value={q.answer} onChange={(e) => updateFacetFAQ(article.topicId, facet.id, fi, (fq) => ({ ...fq, answer: e.target.value }))} rows={2} placeholder="Answer" className={ta} />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* Media brief (read-only) */}
                                    <div className="bg-violet-50 border border-violet-100 rounded-lg p-3">
                                      <p className="text-xs font-semibold text-violet-700 mb-1">Media Brief</p>
                                      <p className="text-xs text-violet-600">{facet.mediaBrief}</p>
                                    </div>
                                    {/* Citations (read-only) */}
                                    {facet.citationSuggestions?.length > 0 && (
                                      <div className="space-y-1.5">
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Citation Suggestions</p>
                                        {facet.citationSuggestions.map((c, ci) => (
                                          <div key={ci} className="bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                                            <p className="text-xs font-semibold text-amber-800">{c.claim}</p>
                                            <p className="text-xs text-amber-700 mt-0.5">Source: {c.sourceType}</p>
                                            <p className="text-xs text-amber-600 font-mono mt-0.5">Search: {c.searchQuery}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Master FAQ */}
                      {article.masterFAQ?.length > 0 && (
                        <div className="px-6 py-5">
                          <Label text={`Master FAQ (${article.masterFAQ.length} items)`} />
                          <div className="space-y-2">
                            {article.masterFAQ.map((q, fi) => (
                              <div key={fi} className="bg-gray-50 rounded-lg p-3 space-y-2">
                                <input type="text" value={q.question} onChange={(e) => updateMasterFAQ(article.topicId, fi, (fq) => ({ ...fq, question: e.target.value }))} placeholder="Question" className={inp} />
                                <textarea value={q.answer} onChange={(e) => updateMasterFAQ(article.topicId, fi, (fq) => ({ ...fq, answer: e.target.value }))} rows={2} placeholder="Answer" className={ta} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Conclusion + CTA */}
                      <div className="px-6 py-5 space-y-4">
                        <div>
                          <Label text="Conclusion" />
                          <textarea value={article.conclusion} onChange={(e) => updateArticle(article.topicId, (a) => ({ ...a, conclusion: e.target.value }))} rows={3} className={ta} />
                        </div>
                        <div>
                          <Label text="CTA" />
                          <input type="text" value={article.cta} onChange={(e) => updateArticle(article.topicId, (a) => ({ ...a, cta: e.target.value }))} className={inp} />
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Approve */}
          <div className="flex items-center gap-4 pt-2 pb-8">
            <button
              onClick={approveAll}
              disabled={saving}
              className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : `Approve All ${articles.length} Articles & Continue →`}
            </button>
            <p className="text-xs text-gray-400">Edit any section, then approve to unlock publishing.</p>
          </div>
        </>
      )}
    </div>
  );
}
