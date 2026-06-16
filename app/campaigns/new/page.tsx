"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

type ProfileSummary = {
  id: string;
  name: string;
  service: string;
  location: string;
};

export default function NewCampaignPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/profiles")
      .then((r) => r.json())
      .then((data) => { setProfiles(data); setLoading(false); });
  }, []);

  async function handleStart() {
    if (!selectedId) return;
    setCreating(true);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceProfileId: selectedId }),
    });
    if (res.ok) {
      const campaign = await res.json();
      router.push(`/campaigns/${campaign.id}/queries`);
    } else {
      toast.error("Failed to create campaign");
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 mb-3 inline-block">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Campaign</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select a service profile to seed this campaign with client details.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading profiles...</div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="text-4xl mb-3">◈</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No service profiles yet</h2>
          <p className="text-sm text-gray-500 mb-6">
            Create a service profile first — it holds the client details that drive content generation.
          </p>
          <Link
            href="/profiles"
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700"
          >
            Create a Profile
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-8">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left bg-white border rounded-xl px-6 py-4 transition-colors ${
                  selectedId === p.id
                    ? "border-gray-900 ring-2 ring-gray-900"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <div className="font-semibold text-gray-900 text-sm">{p.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {p.service} · {p.location}
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleStart}
              disabled={!selectedId || creating}
              className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? "Creating..." : "Start Campaign →"}
            </button>
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
              Cancel
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
