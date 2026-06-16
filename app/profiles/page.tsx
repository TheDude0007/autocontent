"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ProfileForm } from "@/components/profile-form";

type Profile = {
  id: string;
  name: string;
  service: string;
  location: string;
  targetAudience: string;
  painPoints: string[];
  usps: string[];
  salesObjections: string[];
  toneNotes: string;
  createdAt: string;
};

type ProfileSummary = Pick<Profile, "id" | "name" | "service" | "location" | "createdAt">;

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfiles() {
    const res = await fetch("/api/profiles");
    if (res.ok) setProfiles(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadProfiles(); }, []);

  async function handleSave(data: Omit<Profile, "id" | "createdAt">) {
    if (editingId) {
      const res = await fetch(`/api/profiles/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("Profile updated");
        setEditingId(null);
        setEditingProfile(null);
        loadProfiles();
      }
    } else {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("Profile created");
        setShowForm(false);
        loadProfiles();
      }
    }
  }

  async function handleEdit(id: string) {
    const res = await fetch(`/api/profiles/${id}`);
    if (res.ok) {
      setEditingProfile(await res.json());
      setEditingId(id);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this profile? Campaigns using it will also be deleted.")) return;
    const res = await fetch(`/api/profiles/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Profile deleted");
      loadProfiles();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Profiles</h1>
          <p className="text-sm text-gray-500 mt-1">
            Save client service details once and reuse them across campaigns.
          </p>
        </div>
        {!showForm && !editingId && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
          >
            + New Profile
          </button>
        )}
      </div>

      {(showForm || editingId) && (
        <div className="mb-8 bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">
              {editingId ? "Edit Profile" : "New Profile"}
            </h2>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setEditingProfile(null); }}
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
          <ProfileForm
            defaultValues={editingProfile ?? undefined}
            onSave={handleSave}
          />
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading...</div>
      ) : profiles.length === 0 && !showForm ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="text-4xl mb-3">◈</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No profiles yet</h2>
          <p className="text-sm text-gray-500 mb-6">
            Enter your client&apos;s service details to get started.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700"
          >
            Create your first profile
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-gray-200 rounded-xl px-6 py-4 flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-gray-900 text-sm">{p.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {p.service} · {p.location}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-400">
                  {new Date(p.createdAt).toLocaleDateString()}
                </div>
                <button
                  onClick={() => handleEdit(p.id)}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-sm text-red-500 hover:text-red-700 font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
