"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { ServicePage } from "./page";

type Props = {
  campaignId: string;
  profileName: string;
  service: string;
  location: string;
  initialDraft: ServicePage | null;
  alreadyGenerated: boolean;
};

export function PageClient({
  campaignId,
  profileName,
  service,
  location,
  initialDraft,
  alreadyGenerated,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<ServicePage | null>(initialDraft);
  const [streaming, setStreaming] = useState(false);
  const [streamPreview, setStreamPreview] = useState("");
  const [generated, setGenerated] = useState(alreadyGenerated || !!initialDraft);
  const [saving, setSaving] = useState(false);
  const streamRef = useRef<AbortController | null>(null);

  async function generate() {
    setStreaming(true);
    setStreamPreview("");
    streamRef.current = new AbortController();

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/page`, {
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
            if (campaign.mainPageDraft) {
              setDraft(JSON.parse(campaign.mainPageDraft));
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

  function setHeroIntro(val: string) {
    setDraft((d) => d && { ...d, heroIntro: val });
  }
  function setCta(val: string) {
    setDraft((d) => d && { ...d, cta: val });
  }
  function setMetaTitle(val: string) {
    setDraft((d) => d && { ...d, metaTitle: val });
  }
  function setMetaDescription(val: string) {
    setDraft((d) => d && { ...d, metaDescription: val });
  }
  function setBodySection(i: number, field: "heading" | "content", val: string) {
    setDraft((d) => {
      if (!d) return d;
      const sections = [...d.bodySections];
      sections[i] = { ...sections[i], [field]: val };
      return { ...d, bodySections: sections };
    });
  }
  function setFAQItem(i: number, field: "question" | "answer", val: string) {
    setDraft((d) => {
      if (!d) return d;
      const faq = [...d.faq];
      faq[i] = { ...faq[i], [field]: val };
      return { ...d, faq };
    });
  }

  async function approve() {
    if (!draft) return;
    setSaving(true);
    const res = await fetch(`/api/campaigns/${campaignId}/page/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (res.ok) {
      toast.success("Service page approved — planning article topics next");
      router.push(`/campaigns/${campaignId}/topics`);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.error ? JSON.stringify(err.error) : "Approval failed");
      setSaving(false);
    }
  }

  const metaTitleLen = draft?.metaTitle.length ?? 0;
  const metaDescLen = draft?.metaDescription.length ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 mb-3 inline-block">
          ← Dashboard
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Page</h1>
            <p className="text-sm text-gray-500 mt-1">
              {profileName} · {service} · {location}
            </p>
          </div>
          <div className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
            Step 2 of 5
          </div>
        </div>
      </div>

      {/* Generate button (no draft yet) */}
      {!generated && !streaming && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center mb-6">
          <div className="text-3xl mb-3">◈</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Ready to draft the service page
          </h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Claude will write the hero intro, three body sections, 7 FAQ items drawn from
            real objections, a CTA, and SEO meta fields — all based on your approved queries.
          </p>
          <button
            onClick={generate}
            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
          >
            Generate Service Page
          </button>
        </div>
      )}

      {/* Streaming preview */}
      {streaming && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-700">Writing page content...</span>
          </div>
          <pre className="text-xs text-gray-500 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
            {streamPreview}
          </pre>
        </div>
      )}

      {/* Editor */}
      {generated && !streaming && draft && (
        <>
          {/* Regenerate link */}
          <div className="flex justify-end mb-4">
            <button
              onClick={generate}
              className="text-sm text-gray-500 hover:text-gray-900 font-medium"
            >
              ↺ Regenerate All
            </button>
          </div>

          <div className="space-y-6 mb-8">
            {/* Hero Intro */}
            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <SectionLabel label="Hero Intro" />
              <textarea
                value={draft.heroIntro}
                onChange={(e) => setHeroIntro(e.target.value)}
                rows={4}
                className={textareaClass}
              />
            </section>

            {/* Body Sections */}
            {draft.bodySections.map((section, i) => (
              <section key={i} className="bg-white border border-gray-200 rounded-xl p-6">
                <SectionLabel label={`Body Section ${i + 1}`} />
                <input
                  type="text"
                  value={section.heading}
                  onChange={(e) => setBodySection(i, "heading", e.target.value)}
                  placeholder="H2 Heading"
                  className={inputClass + " mb-3"}
                />
                <textarea
                  value={section.content}
                  onChange={(e) => setBodySection(i, "content", e.target.value)}
                  rows={6}
                  className={textareaClass}
                />
              </section>
            ))}

            {/* FAQ */}
            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <SectionLabel label={`FAQ (${draft.faq.length} items)`} />
              <div className="space-y-4">
                {draft.faq.map((item, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                      Q{i + 1}
                    </p>
                    <input
                      type="text"
                      value={item.question}
                      onChange={(e) => setFAQItem(i, "question", e.target.value)}
                      className={inputClass + " mb-2"}
                    />
                    <textarea
                      value={item.answer}
                      onChange={(e) => setFAQItem(i, "answer", e.target.value)}
                      rows={3}
                      className={textareaClass}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* CTA */}
            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <SectionLabel label="Call to Action" />
              <textarea
                value={draft.cta}
                onChange={(e) => setCta(e.target.value)}
                rows={3}
                className={textareaClass}
              />
            </section>

            {/* Meta fields */}
            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <SectionLabel label="SEO Meta" />
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">Meta Title</label>
                    <span className={`text-xs ${metaTitleLen > 60 ? "text-red-500" : "text-gray-400"}`}>
                      {metaTitleLen}/60
                    </span>
                  </div>
                  <input
                    type="text"
                    value={draft.metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">Meta Description</label>
                    <span className={`text-xs ${metaDescLen > 155 ? "text-red-500" : "text-gray-400"}`}>
                      {metaDescLen}/155
                    </span>
                  </div>
                  <textarea
                    value={draft.metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    rows={3}
                    className={textareaClass}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Approve CTA */}
          <div className="flex items-center gap-4 pt-2 pb-8">
            <button
              onClick={approve}
              disabled={saving}
              className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : "Approve Page & Continue →"}
            </button>
            <p className="text-xs text-gray-400">
              Edit any field above, then approve to unlock article topic planning.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{label}</p>
  );
}

const textareaClass =
  "w-full text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-colors";

const inputClass =
  "w-full text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-colors";
