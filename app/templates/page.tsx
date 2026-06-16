"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

type Block = {
  id: string;
  variableName: string;
  acfFieldName: string;
  contentType: string;
  required: boolean;
  order: number;
};

type Template = {
  id: string;
  name: string;
  pageType: "SERVICE_PAGE" | "ARTICLE" | "LANDING_PAGE";
  blocks: Block[];
  createdAt: string;
};

const pageTypeLabels: Record<string, string> = {
  SERVICE_PAGE: "Service Page",
  ARTICLE: "Article",
  LANDING_PAGE: "Landing Page",
};

const contentTypeLabel: Record<string, string> = {
  TEXT: "Text",
  FAQ: "FAQ",
  HEADING: "Heading",
  CTA: "CTA",
  META_TITLE: "Meta Title",
  META_DESCRIPTION: "Meta Desc",
  MEDIA_PLACEHOLDER: "Media",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", pageType: "SERVICE_PAGE" as Template["pageType"] });
  const [saving, setSaving] = useState(false);
  const [editingBlocks, setEditingBlocks] = useState<Record<string, Block[]>>({});
  const [savingBlocks, setSavingBlocks] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/templates");
    const data = await res.json();
    setTemplates(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function getBlocks(template: Template): Block[] {
    return editingBlocks[template.id] ?? template.blocks;
  }

  function updateBlock(templateId: string, blockId: string, field: keyof Block, value: string | boolean) {
    setEditingBlocks((prev) => {
      const blocks = prev[templateId] ?? templates.find((t) => t.id === templateId)!.blocks;
      return {
        ...prev,
        [templateId]: blocks.map((b) => (b.id === blockId ? { ...b, [field]: value } : b)),
      };
    });
  }

  async function saveBlocks(templateId: string) {
    setSavingBlocks(templateId);
    const blocks = getBlocks(templates.find((t) => t.id === templateId)!);
    const res = await fetch(`/api/templates/${templateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks: blocks.map((b) => ({ id: b.id, acfFieldName: b.acfFieldName, required: b.required })) }),
    });
    if (res.ok) {
      toast.success("Template saved");
      load();
    } else {
      toast.error("Save failed");
    }
    setSavingBlocks(null);
  }

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast.success("Template created with default field mappings");
      setForm({ name: "", pageType: "SERVICE_PAGE" });
      setShowForm(false);
      load();
    } else {
      toast.error("Failed to create template");
    }
    setSaving(false);
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    toast.success("Template deleted");
    load();
  }

  const inp = "text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-colors";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Map content fields to ACF field names for each WordPress page type.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
        >
          {showForm ? "Cancel" : "+ New Template"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={createTemplate}
          className="bg-white border border-gray-200 rounded-xl p-6 mb-6 flex gap-4 items-end"
        >
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 block mb-1">Template Name</label>
            <input
              className="w-full text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-colors"
              placeholder="e.g. Divi Service Page v1"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="w-48">
            <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
            <select
              className="w-full text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
              value={form.pageType}
              onChange={(e) => setForm((f) => ({ ...f, pageType: e.target.value as Template["pageType"] }))}
            >
              <option value="SERVICE_PAGE">Service Page</option>
              <option value="ARTICLE">Article</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </form>
      )}

      {/* Templates list */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : templates.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-xl">
          <div className="text-3xl mb-3">◫</div>
          <p className="text-sm text-gray-500 mb-2">No templates yet.</p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Create a template to customize which ACF fields your content gets pushed into.
            Default field names are pre-filled.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => {
            const isOpen = openId === template.id;
            const blocks = getBlocks(template);
            return (
              <div key={template.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4">
                  <button
                    onClick={() => setOpenId(isOpen ? null : template.id)}
                    className="flex items-center gap-3 text-left flex-1"
                  >
                    <span className="text-sm font-semibold text-gray-900">{template.name}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {pageTypeLabels[template.pageType]}
                    </span>
                    <span className="text-xs text-gray-400">{blocks.length} fields</span>
                    <span className="text-gray-400 text-xs ml-auto mr-4">{isOpen ? "▲" : "▼"}</span>
                  </button>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Delete
                  </button>
                </div>

                {/* Block editor */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-6 py-5">
                    <p className="text-xs text-gray-500 mb-4">
                      Edit the <strong>ACF Field Name</strong> column to match your WordPress theme&apos;s field keys.
                    </p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                          <th className="text-left pb-2 pr-4 w-8">#</th>
                          <th className="text-left pb-2 pr-4">Content Field</th>
                          <th className="text-left pb-2 pr-4">Type</th>
                          <th className="text-left pb-2 pr-4">ACF Field Name</th>
                          <th className="text-left pb-2">Required</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {blocks.map((block) => (
                          <tr key={block.id} className="py-2">
                            <td className="py-2 pr-4 text-xs text-gray-300 font-mono">{block.order}</td>
                            <td className="py-2 pr-4">
                              <code className="text-xs bg-gray-50 px-1.5 py-0.5 rounded text-gray-600">
                                {block.variableName}
                              </code>
                            </td>
                            <td className="py-2 pr-4">
                              <span className="text-xs text-gray-500">
                                {contentTypeLabel[block.contentType] ?? block.contentType}
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              <input
                                className={inp + " w-full"}
                                value={block.acfFieldName}
                                onChange={(e) =>
                                  updateBlock(template.id, block.id, "acfFieldName", e.target.value)
                                }
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="checkbox"
                                checked={block.required}
                                onChange={(e) =>
                                  updateBlock(template.id, block.id, "required", e.target.checked)
                                }
                                className="rounded"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => saveBlocks(template.id)}
                        disabled={savingBlocks === template.id}
                        className="px-4 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-700 disabled:opacity-40 transition-colors"
                      >
                        {savingBlocks === template.id ? "Saving..." : "Save Field Names"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
