"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { Topic } from "./page";

type Props = {
  campaignId: string;
  profileName: string;
  service: string;
  location: string;
  initialTopics: Topic[];
  initialSelectedIds: string[];
  alreadyGenerated: boolean;
  alreadySelected: boolean;
};

const valueColors: Record<string, string> = {
  High: "bg-green-100 text-green-700",
  Medium: "bg-blue-100 text-blue-700",
};

export function TopicsClient({
  campaignId,
  profileName,
  service,
  location,
  initialTopics,
  initialSelectedIds,
  alreadyGenerated,
  alreadySelected,
}: Props) {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelectedIds)
  );
  const [streaming, setStreaming] = useState(false);
  const [streamPreview, setStreamPreview] = useState("");
  const [generated, setGenerated] = useState(alreadyGenerated);
  const [saving, setSaving] = useState(false);
  const streamRef = useRef<AbortController | null>(null);

  async function generate() {
    setStreaming(true);
    setStreamPreview("");
    setSelectedIds(new Set());
    streamRef.current = new AbortController();

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/topics`, {
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
            if (campaign.articleTopics) {
              setTopics(JSON.parse(campaign.articleTopics));
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
      if ((err as Error).name !== "AbortError") toast.error("Generation failed");
      setStreaming(false);
    }
  }

  function toggleTopic(id: string) {
    if (alreadySelected) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 5) {
          toast.error("Select up to 5 topics");
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  async function selectTopics() {
    if (selectedIds.size === 0) {
      toast.error("Select at least one topic");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/campaigns/${campaignId}/topics/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicIds: Array.from(selectedIds) }),
    });
    if (res.ok) {
      toast.success("Topics locked in — generating articles next");
      router.push(`/campaigns/${campaignId}/articles`);
    } else {
      toast.error("Selection failed");
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
            <h1 className="text-2xl font-bold text-gray-900">Article Topics</h1>
            <p className="text-sm text-gray-500 mt-1">
              {profileName} · {service} · {location}
            </p>
          </div>
          <div className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
            Step 3 of 5
          </div>
        </div>
      </div>

      {/* Generate button */}
      {!generated && !streaming && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center mb-6">
          <div className="text-3xl mb-3">◈</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Suggest supporting articles
          </h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Claude will suggest 8 article topics that strengthen the main page&apos;s
            topical authority. You pick up to 5 to write.
          </p>
          <button
            onClick={generate}
            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
          >
            Generate Topics
          </button>
        </div>
      )}

      {/* Streaming */}
      {streaming && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-700">Generating topic ideas...</span>
          </div>
          <pre className="text-xs text-gray-500 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
            {streamPreview}
          </pre>
        </div>
      )}

      {/* Topic cards */}
      {generated && !streaming && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">
                {selectedIds.size > 0
                  ? `${selectedIds.size} of ${topics.length} selected`
                  : `${topics.length} topic suggestions`}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {alreadySelected
                  ? "Topics locked. Proceed to article generation."
                  : "Pick up to 5 to write, then continue."}
              </p>
            </div>
            {!alreadySelected && (
              <button
                onClick={generate}
                className="text-sm text-gray-500 hover:text-gray-900 font-medium"
              >
                ↺ Regenerate
              </button>
            )}
          </div>

          <div className="space-y-3 mb-6">
            {topics.map((topic) => {
              const isSelected = selectedIds.has(topic.id);
              return (
                <button
                  key={topic.id}
                  onClick={() => toggleTopic(topic.id)}
                  disabled={alreadySelected}
                  className={`w-full text-left bg-white border rounded-xl px-5 py-4 transition-all ${
                    isSelected
                      ? "border-gray-900 ring-1 ring-gray-900"
                      : "border-gray-200 hover:border-gray-400"
                  } ${alreadySelected ? "cursor-default" : "cursor-pointer"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                          isSelected ? "bg-gray-900 border-gray-900" : "border-gray-300"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 mb-0.5">
                          {topic.title}
                        </p>
                        <p className="text-xs text-gray-500">{topic.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${valueColors[topic.value] ?? "bg-gray-100 text-gray-600"}`}>
                        {topic.value}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">{topic.targetQuery}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* CTA */}
          {!alreadySelected && (
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={selectTopics}
                disabled={saving || selectedIds.size === 0}
                className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving..." : `Write ${selectedIds.size > 0 ? selectedIds.size : ""} Article${selectedIds.size !== 1 ? "s" : ""} →`}
              </button>
              <p className="text-xs text-gray-400">Select 1–5 topics, then continue.</p>
            </div>
          )}

          {alreadySelected && (
            <div className="pt-2">
              <button
                onClick={() => router.push(`/campaigns/${campaignId}/articles`)}
                className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
              >
                Continue to Article Generation →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
