"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Product { id: string; name: string; base_url: string; }

export default function NewScriptPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/products")
      .then(r => r.json())
      .then(d => setProducts(d.products ?? []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const talkingPoints = String(fd.get("talkingPoints") ?? "")
      .split("\n").map(s => s.trim()).filter(Boolean);

    try {
      const res = await fetch("/api/dashboard/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:           fd.get("name"),
          product_id:     fd.get("product_id") || null,
          talking_points: talkingPoints,
          tone:           fd.get("tone"),
          is_default:     fd.get("is_default") === "on",
          steps:          [],
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      router.push(`/dashboard/scripts/${data.id}`);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">New demo script</h1>
      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Script name</label>
          <input name="name" type="text" required placeholder="e.g. Main product demo" className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        {products.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Product <span className="text-gray-500">(optional)</span></label>
            <select name="product_id" className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— no product —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Narration tone</label>
          <select name="tone" className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="confident">Confident — authoritative, results-focused</option>
            <option value="friendly">Friendly — warm, conversational</option>
            <option value="urgent">Urgent — high-energy, problem-solution</option>
            <option value="neutral">Neutral — factual, low-pressure</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Key talking points</label>
          <textarea name="talkingPoints" required rows={6} placeholder={"One per line, e.g.:\nSaves 3 hours per week\nNative Salesforce integration\nAI-powered lead scoring"} className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          <p className="mt-1 text-xs text-gray-500">AI will weave these into the voiceover as it narrates each step.</p>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" name="is_default" id="is_default" className="rounded border-gray-600" />
          <label htmlFor="is_default" className="text-sm text-gray-300">Set as default script for new video jobs</label>
        </div>

        {error && <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg px-3.5 py-2.5">{error}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="flex-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 text-sm transition-colors">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 text-sm transition-colors">{loading ? "Saving…" : "Create script"}</button>
        </div>
      </form>
    </div>
  );
}
