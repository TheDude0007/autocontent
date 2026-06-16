"use client";

import { useState } from "react";

type ProfileData = {
  name: string;
  service: string;
  location: string;
  targetAudience: string;
  painPoints: string[];
  usps: string[];
  salesObjections: string[];
  toneNotes: string;
};

type Props = {
  defaultValues?: Partial<ProfileData>;
  onSave: (data: ProfileData) => void;
};

function joinLines(arr: string[] | undefined) {
  return arr?.join("\n") ?? "";
}

function splitLines(str: string) {
  return str.split("\n").map((l) => l.trim()).filter(Boolean);
}

export function ProfileForm({ defaultValues, onSave }: Props) {
  const [form, setForm] = useState({
    name: defaultValues?.name ?? "",
    service: defaultValues?.service ?? "",
    location: defaultValues?.location ?? "",
    targetAudience: defaultValues?.targetAudience ?? "",
    painPoints: joinLines(defaultValues?.painPoints),
    usps: joinLines(defaultValues?.usps),
    salesObjections: joinLines(defaultValues?.salesObjections),
    toneNotes: defaultValues?.toneNotes ?? "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      name: form.name,
      service: form.service,
      location: form.location,
      targetAudience: form.targetAudience,
      painPoints: splitLines(form.painPoints),
      usps: splitLines(form.usps),
      salesObjections: splitLines(form.salesObjections),
      toneNotes: form.toneNotes,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Profile Name" required>
          <input
            className="field"
            placeholder="e.g. Las Vegas Web Design Co — Web Design"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
          />
        </Field>
        <Field label="Service" required>
          <input
            className="field"
            placeholder="e.g. custom web design"
            value={form.service}
            onChange={(e) => set("service", e.target.value)}
            required
          />
        </Field>
        <Field label="Location" required>
          <input
            className="field"
            placeholder="e.g. Las Vegas, NV"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            required
          />
        </Field>
        <Field label="Target Audience" required>
          <input
            className="field"
            placeholder="e.g. small business owners in Las Vegas"
            value={form.targetAudience}
            onChange={(e) => set("targetAudience", e.target.value)}
            required
          />
        </Field>
      </div>

      <Field label="Pain Points" hint="One per line">
        <textarea
          className="field min-h-[80px]"
          placeholder={"Outdated website hurting credibility\nNo online presence\nLosing customers to competitors"}
          value={form.painPoints}
          onChange={(e) => set("painPoints", e.target.value)}
          rows={3}
        />
      </Field>

      <Field label="Unique Selling Points (USPs)" hint="One per line">
        <textarea
          className="field min-h-[80px]"
          placeholder={"Local Las Vegas team\nFast 2-week turnaround\nFree strategy call"}
          value={form.usps}
          onChange={(e) => set("usps", e.target.value)}
          rows={3}
        />
      </Field>

      <Field label="Common Sales Objections" hint="One per line — these become FAQ answers">
        <textarea
          className="field min-h-[80px]"
          placeholder={"How long does it take?\nIs it too expensive?\nWill I own the website?"}
          value={form.salesObjections}
          onChange={(e) => set("salesObjections", e.target.value)}
          rows={3}
        />
      </Field>

      <Field label="Tone & Style Notes">
        <textarea
          className="field"
          placeholder="e.g. Professional but approachable, no jargon, speak directly to business owners"
          value={form.toneNotes}
          onChange={(e) => set("toneNotes", e.target.value)}
          rows={2}
        />
      </Field>

      <div className="pt-2">
        <button
          type="submit"
          className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
        >
          Save Profile
        </button>
      </div>

      <style jsx>{`
        .field {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 13px;
          color: #111827;
          background: white;
          outline: none;
          transition: border-color 0.15s;
          resize: vertical;
        }
        .field:focus {
          border-color: #6b7280;
        }
        .field::placeholder {
          color: #9ca3af;
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {hint && <span className="font-normal text-gray-400 ml-1.5">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
