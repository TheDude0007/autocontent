"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

type Query = {
  id: string;
  text: string;
  volumeTier: "High" | "Medium" | "Low";
  intentType: "Informational" | "Transactional" | "Navigational";
};

type Props = {
  campaignId: string;
  profileName: string;
  service: string;
  location: string;
  initialQueries: Query[];
  alreadyGenerated: boolean;
};

const tierColors: Record<string, string> = {
  High: "bg-green-100 text-green-700",
  Medium: "bg-blue-100 text-blue-700",
  Low: "bg-gray-100 text-gray-600",
};

const intentColors: Record<string, string> = {
  Transactional: "bg-amber-100 text-amber-700",
  Informational: "bg-purple-100 text-purple-700",
  Navigational: "bg-gray-100 text-gray-600",
};

export function QueriesClient({
  campaignId,
  profileName,
  service,
  location,
  initialQueries,
  alreadyGenerated,
}: Props) {
  const router = useRouter();
  const [queries, setQueries] = useState<Query[]>(initialQueries);
  const [streaming, setStreaming] = useState(false);
  const [streamPreview, setStreamPreview] = useState("");
  const [generated, setGenerated] = useState(alreadyGenerated);
  const [approving, setApproving] = useState(false);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const streamRef = useRef<AbortController | null>(null);

  const visibleQueries = queries.filter((q) => !removedIds.has(q.id));

  async function generate() {
    setStreaming(true);
    setStreamPreview("");
    streamRef.current = new AbortController();

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/queries`, {
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
            // Fetch final parsed queries from server
            const updated = await fetch(`/api/campaigns/${campaignId}`);
            const campaign = await updated.json();
            if (campaign.generatedQueries) {
              setQueries(JSON.parse(campaign.generatedQueries));
            }
            setGenerated(true);
            setStreaming(false);
            setStreamPreview("");
            return;
          }

          const parsed = JSON.parse(data);
          if (parsed.error) {
            toast.error(parsed.error);
            setStreaming(false);
            return;
          }
          if (parsed.text) {
            setStreamPreview((p) => p + parsed.text);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error("Generation failed");
      }
      setStreaming(false);
    }
  }

  function removeQuery(id: string) {
    setRemovedIds((prev) => new Set([...prev, id]));
  }

  function restoreQuery(id: string) {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function moveQuery(index: number, direction: -1 | 1) {
    const list = [...visibleQueries];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    // Rebuild full list preserving removed items in place
    setQueries((prev) =>
      prev.map((q) => {
        const idx = list.findIndex((v) => v.id === q.id);
        return idx >= 0 ? list[idx] : q;
      })
    );
  }

  async function approve() {
    if (visibleQueries.length === 0) {
      toast.error("Keep at least one query");
      return;
    }
    setApproving(true);
    const res = await fetch(`/api/campaigns/${campaignId}/queries/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries: visibleQueries }),
    });
    if (res.ok) {
      toast.success("Queries approved — generating service page next");
      router.push(`/campaigns/${campaignId}/page`);
    } else {
      toast.error("Approval failed");
      setApproving(false);
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
            <h1 className="text-2xl font-bold text-gray-900">Query Research</h1>
            <p className="text-sm text-gray-500 mt-1">
              {profileName} · {service} · {location}
            </p>
          </div>
          <div className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
            Step 1 of 5
          </div>
        </div>
      </div>

      {/* Generate / streaming state */}
      {!generated && !streaming && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center mb-6">
          <div className="text-3xl mb-3">◈</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Ready to brainstorm search queries
          </h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Claude will generate 25 search queries your target customers use, tagged by
            volume tier and intent type.
          </p>
          <button
            onClick={generate}
            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
          >
            Generate Queries
          </button>
        </div>
      )}

      {streaming && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-700">Generating queries...</span>
          </div>
          <pre className="text-xs text-gray-500 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
            {streamPreview}
          </pre>
        </div>
      )}

      {/* Query list */}
      {generated && !streaming && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">
                {visibleQueries.length} queries selected
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Remove irrelevant ones, reorder by priority, then approve to continue.
              </p>
            </div>
            <button
              onClick={generate}
              className="text-sm text-gray-500 hover:text-gray-900 font-medium"
            >
              ↺ Regenerate
            </button>
          </div>

          <div className="space-y-2 mb-6">
            {visibleQueries.map((q, i) => (
              <div
                key={q.id}
                className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3"
              >
                {/* Reorder */}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => moveQuery(i, -1)}
                    disabled={i === 0}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-0 text-xs leading-none"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveQuery(i, 1)}
                    disabled={i === visibleQueries.length - 1}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-0 text-xs leading-none"
                  >
                    ▼
                  </button>
                </div>

                {/* Priority number */}
                <span className="text-xs font-mono text-gray-300 w-5 text-right flex-shrink-0">
                  {i + 1}
                </span>

                {/* Query text */}
                <span className="flex-1 text-sm text-gray-900">{q.text}</span>

                {/* Tags */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tierColors[q.volumeTier]}`}>
                  {q.volumeTier}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${intentColors[q.intentType]}`}>
                  {q.intentType}
                </span>

                {/* Remove */}
                <button
                  onClick={() => removeQuery(q.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 ml-1"
                  title="Remove query"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Removed queries — restore option */}
          {removedIds.size > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Removed ({removedIds.size})
              </p>
              <div className="space-y-1">
                {queries
                  .filter((q) => removedIds.has(q.id))
                  .map((q) => (
                    <div
                      key={q.id}
                      className="flex items-center justify-between px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg opacity-50"
                    >
                      <span className="text-sm text-gray-500 line-through">{q.text}</span>
                      <button
                        onClick={() => restoreQuery(q.id)}
                        className="text-xs text-gray-500 hover:text-gray-900 ml-4"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Approve CTA */}
          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={approve}
              disabled={approving || visibleQueries.length === 0}
              className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {approving ? "Saving..." : `Approve ${visibleQueries.length} Queries & Continue →`}
            </button>
            <p className="text-xs text-gray-400">
              These queries will drive the service page + article content.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
