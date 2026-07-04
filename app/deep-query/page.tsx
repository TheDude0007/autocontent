"use client";

import { useState, useRef } from "react";
import Link from "next/link";

interface FAQ { question: string; answer: string; }
interface SubSection { heading: string; content: string; }
interface CitationSuggestion { claim: string; sourceType: string; searchQuery: string; }
interface SemanticFacet {
  id: string;
  heading: string;
  content: string;
  subSections?: SubSection[];
  faq: FAQ[];
  mediaBrief: string;
  citationSuggestions: CitationSuggestion[];
}
interface RelatedChild { query: string; intent: string; }
interface RelatedQuery { query: string; intent: string; children: RelatedChild[]; }
interface DeepQueryResult {
  rootQuery: string;
  pageH1: string;
  metaTitle: string;
  metaDescription: string;
  introduction: string;
  semanticFacets: SemanticFacet[];
  relatedQueryTree: RelatedQuery[];
  masterFAQ: FAQ[];
  conclusion: string;
  cta: string;
}

interface GeneratedImage {
  facetId: string;
  dataUri: string | null;
  error?: string;
}

const intentColors: Record<string, string> = {
  Informational: "bg-purple-100 text-purple-700",
  Transactional: "bg-amber-100 text-amber-700",
  Navigational: "bg-gray-100 text-gray-600",
};

function extractJSON(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  return text.slice(start, end + 1);
}

export default function DeepQueryPage() {
  const [rootQuery, setRootQuery] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [location, setLocation] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [usps, setUsps] = useState("");
  const [voiceProfile, setVoiceProfile] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamPreview, setStreamPreview] = useState("");
  const [result, setResult] = useState<DeepQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<Record<string, GeneratedImage>>({});
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  async function generate() {
    if (!rootQuery.trim() || !businessName.trim() || !location.trim() || !serviceType.trim()) return;
    setStreaming(true);
    setStreamPreview("");
    setResult(null);
    setError(null);
    setImages({});
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/deep-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootQuery, businessName, location, serviceType, usps, voiceProfile }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        setError("Failed to start generation");
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

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
            const jsonStr = extractJSON(fullText);
            if (jsonStr) {
              try {
                const parsed = JSON.parse(jsonStr) as DeepQueryResult;
                setResult(parsed);
              } catch {
                setError("Generated content could not be parsed. Try again.");
              }
            } else {
              setError("No JSON found in response.");
            }
            setStreaming(false);
            return;
          }

          const parsed = JSON.parse(data);
          if (parsed.error) { setError(parsed.error); setStreaming(false); return; }
          if (parsed.text) {
            fullText += parsed.text;
            setStreamPreview(fullText);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError("Generation failed");
      setStreaming(false);
    }
  }

  async function generateImages(facets: SemanticFacet[]) {
    setGeneratingImages(true);
    setImageProgress(0);

    const payload = facets.map(f => ({
      facetId: f.id,
      heading: f.heading,
      mediaBrief: f.mediaBrief,
    }));

    try {
      const res = await fetch("/api/deep-query/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facets: payload }),
      });
      const data = await res.json() as { images?: GeneratedImage[]; error?: string };
      if (data.error) {
        setError(`Image generation error: ${data.error}`);
      } else if (data.images) {
        const map: Record<string, GeneratedImage> = {};
        data.images.forEach(img => { map[img.facetId] = img; });
        setImages(map);
        setImageProgress(data.images.length);
      }
    } catch {
      setError("Image generation failed");
    } finally {
      setGeneratingImages(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 mb-3 inline-block">
          ← Dashboard
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Deep Query Mode</h1>
            <p className="text-sm text-gray-500 mt-1">
              One query in. Complete content + visual media package out.
            </p>
          </div>
          <span className="text-xs bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full font-medium">
            POC
          </span>
        </div>
      </div>

      {/* Input form */}
      {!result && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
              Root Query *
            </label>
            <input
              type="text"
              value={rootQuery}
              onChange={(e) => setRootQuery(e.target.value)}
              placeholder="e.g. exotic entertainment agencies Las Vegas"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <p className="text-xs text-gray-400 mt-1">The primary search query this page needs to dominate</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                Business Name *
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Wild Entertainment"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                Location *
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Las Vegas, NV"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
              Service Type *
            </label>
            <input
              type="text"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              placeholder="e.g. exotic entertainment agency, adult entertainment booking"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
              Key Differentiators / USPs
            </label>
            <textarea
              value={usps}
              onChange={(e) => setUsps(e.target.value)}
              placeholder="e.g. drug-tested performers, verified Google & Facebook reviews, licensed agency, professional booking process, 10+ years experience"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
              Voice Profile <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={voiceProfile}
              onChange={(e) => setVoiceProfile(e.target.value)}
              placeholder="e.g. Write like Frank — direct, no fluff, German directness. Short sentences. Write for regular people, not academics. First-person credibility. Real talk."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={generate}
              disabled={streaming || !rootQuery.trim() || !businessName.trim() || !location.trim() || !serviceType.trim()}
              className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {streaming ? "Generating..." : "Generate Deep Content Package →"}
            </button>
            {streaming && (
              <button onClick={stop} className="text-sm text-red-500 hover:text-red-700">
                Stop
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stream preview */}
      {streaming && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-700">Building content intelligence package...</span>
          </div>
          <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
            {streamPreview}
          </pre>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-6">
          {/* Header bar */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Content Package Ready</h2>
            <div className="flex items-center gap-3">
              {!generatingImages && Object.keys(images).length === 0 && (
                <button
                  onClick={() => generateImages(result.semanticFacets)}
                  className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-md hover:bg-violet-700 transition-colors flex items-center gap-2"
                >
                  <span>Generate Images</span>
                  <span className="text-violet-300 text-xs">DALL-E 3</span>
                </button>
              )}
              {generatingImages && (
                <div className="flex items-center gap-2 text-sm text-violet-600">
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
                  Generating {result.semanticFacets.length} images...
                </div>
              )}
              {Object.keys(images).length > 0 && !generatingImages && (
                <button
                  onClick={() => generateImages(result.semanticFacets)}
                  className="text-sm text-violet-600 hover:text-violet-800 font-medium"
                >
                  ↺ Regenerate Images
                </button>
              )}
              <button
                onClick={() => { setResult(null); setStreamPreview(""); setError(null); setImages({}); }}
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                ← New Query
              </button>
            </div>
          </div>

          {/* Meta */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Page Meta</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{result.pageH1}</h1>
            <div className="text-xs text-gray-500 mb-1">
              <span className="font-semibold">Title ({result.metaTitle?.length ?? 0}/60):</span> {result.metaTitle}
            </div>
            <div className="text-xs text-gray-500">
              <span className="font-semibold">Description ({result.metaDescription?.length ?? 0}/155):</span> {result.metaDescription}
            </div>
          </div>

          {/* Introduction */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Introduction</div>
            <p className="text-sm text-gray-700 leading-relaxed">{result.introduction}</p>
          </div>

          {/* Semantic Facets */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              {result.semanticFacets?.length ?? 0} Semantic Facets
            </div>
            <div className="space-y-4">
              {result.semanticFacets?.map((facet) => {
                const img = images[facet.id];
                return (
                  <div key={facet.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-100 px-5 py-3">
                      <h2 className="font-bold text-gray-900 text-base">{facet.heading}</h2>
                    </div>

                    {/* Generated image */}
                    {img?.dataUri && (
                      <div className="w-full bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.dataUri}
                          alt={facet.heading}
                          className="w-full object-cover"
                        />
                      </div>
                    )}
                    {generatingImages && !img && (
                      <div className="w-full aspect-[1.75/1] bg-gray-50 flex items-center justify-center">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
                          Generating image...
                        </div>
                      </div>
                    )}
                    {img?.error && (
                      <div className="mx-5 mt-4 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-600">
                        Image failed: {img.error}
                      </div>
                    )}

                    <div className="p-5 space-y-4">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{facet.content}</p>

                      {facet.subSections && facet.subSections.length > 0 && (
                        <div className="space-y-3 pl-4 border-l-2 border-gray-100">
                          {facet.subSections.map((sub, i) => (
                            <div key={i}>
                              <h3 className="font-semibold text-sm text-gray-900 mb-1">{sub.heading}</h3>
                              <p className="text-sm text-gray-600 leading-relaxed">{sub.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* FAQ */}
                      {facet.faq?.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Section FAQ</div>
                          <div className="space-y-2">
                            {facet.faq.map((f, i) => (
                              <div key={i} className="bg-gray-50 rounded-lg p-3">
                                <div className="text-xs font-semibold text-gray-900 mb-1">Q: {f.question}</div>
                                <div className="text-xs text-gray-600">{f.answer}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Media brief */}
                      <div className="bg-violet-50 border border-violet-100 rounded-lg p-3">
                        <div className="text-xs font-semibold text-violet-700 mb-1">
                          {img?.dataUri ? "Image Prompt Used" : "Media Brief"}
                        </div>
                        <div className="text-xs text-violet-600">{facet.mediaBrief}</div>
                      </div>

                      {/* Citations */}
                      {facet.citationSuggestions?.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Citation Suggestions</div>
                          <div className="space-y-1.5">
                            {facet.citationSuggestions.map((c, i) => (
                              <div key={i} className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                                <div className="text-xs font-semibold text-amber-800 mb-0.5">Claim: {c.claim}</div>
                                <div className="text-xs text-amber-700">Source: {c.sourceType}</div>
                                <div className="text-xs text-amber-600 mt-0.5 font-mono">Search: {c.searchQuery}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Master FAQ */}
          {result.masterFAQ?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Master FAQ ({result.masterFAQ.length} items)
              </div>
              <div className="space-y-3">
                {result.masterFAQ.map((f, i) => (
                  <div key={i} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div className="text-sm font-semibold text-gray-900 mb-1">{f.question}</div>
                    <div className="text-sm text-gray-600 leading-relaxed">{f.answer}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Query Tree */}
          {result.relatedQueryTree?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Related Query Tree ({result.relatedQueryTree.length} branches)
              </div>
              <div className="space-y-3">
                {result.relatedQueryTree.map((rq, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-medium text-gray-900">{rq.query}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${intentColors[rq.intent] ?? "bg-gray-100 text-gray-600"}`}>
                        {rq.intent}
                      </span>
                    </div>
                    {rq.children?.length > 0 && (
                      <div className="pl-4 space-y-1 border-l-2 border-gray-100">
                        {rq.children.map((child, j) => (
                          <div key={j} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">{child.query}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${intentColors[child.intent] ?? "bg-gray-100 text-gray-600"}`}>
                              {child.intent}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conclusion + CTA */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Conclusion</div>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">{result.conclusion}</p>
            <div className="bg-gray-900 text-white rounded-lg px-4 py-3 text-sm font-medium">
              {result.cta}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
