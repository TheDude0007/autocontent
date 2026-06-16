"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

type Site = { id: string; name: string; url: string; username: string; createdAt: string };

export default function SettingsPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", url: "", username: "", appPassword: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/sites");
    const data = await res.json();
    setSites(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast.success("Site added");
      setForm({ name: "", url: "", username: "", appPassword: "" });
      setShowForm(false);
      load();
    } else {
      toast.error("Failed to save site");
    }
    setSaving(false);
  }

  async function testSite(id: string) {
    setTesting(id);
    const res = await fetch(`/api/sites/${id}/test`, { method: "POST" });
    const data = await res.json() as { ok: boolean; siteTitle?: string; error?: string };
    if (data.ok) {
      toast.success(`Connected${data.siteTitle ? ` — ${data.siteTitle}` : ""}`);
    } else {
      toast.error(data.error || "Connection failed");
    }
    setTesting(null);
  }

  async function deleteSite(id: string) {
    if (!confirm("Remove this WP site? Campaigns that used it won't be affected.")) return;
    setDeleting(id);
    await fetch(`/api/sites/${id}`, { method: "DELETE" });
    toast.success("Site removed");
    load();
    setDeleting(null);
  }

  const inp = "w-full text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-colors";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">WordPress site credentials for publishing.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Site"}
        </button>
      </div>

      {/* Add site form */}
      {showForm && (
        <form
          onSubmit={create}
          className="bg-white border border-gray-200 rounded-xl p-6 mb-6 space-y-4"
        >
          <h2 className="font-semibold text-gray-900 mb-1">New WordPress Site</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Display Name</label>
              <input
                className={inp}
                placeholder="My Client Site"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Site URL</label>
              <input
                className={inp}
                placeholder="https://example.com"
                type="url"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">WP Username</label>
              <input
                className={inp}
                placeholder="admin"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Application Password
                <span className="ml-1 text-gray-400 font-normal">
                  (WP Admin → Users → Application Passwords)
                </span>
              </label>
              <input
                className={inp}
                type="password"
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                value={form.appPassword}
                onChange={(e) => setForm((f) => ({ ...f, appPassword: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {saving ? "Saving..." : "Save Site"}
            </button>
          </div>
        </form>
      )}

      {/* Sites list */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : sites.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-xl">
          <div className="text-3xl mb-3">◎</div>
          <p className="text-sm text-gray-500 mb-2">No WordPress sites configured yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-sm font-medium text-gray-900 underline"
          >
            Add your first site
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((site) => (
            <div
              key={site.id}
              className="bg-white border border-gray-200 rounded-xl px-6 py-4 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">{site.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {site.url} · {site.username}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => testSite(site.id)}
                  disabled={testing === site.id}
                  className="text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md px-3 py-1.5 hover:border-gray-400 transition-colors disabled:opacity-40"
                >
                  {testing === site.id ? "Testing..." : "Test Connection"}
                </button>
                <button
                  onClick={() => deleteSite(site.id)}
                  disabled={deleting === site.id}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
