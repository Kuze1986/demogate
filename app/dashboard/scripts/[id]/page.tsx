"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Script {
  id: string; name: string; tone: string; is_default: boolean;
  talking_points: string[]; steps: unknown[]; product_id: string | null;
}
interface Product { id: string; name: string; }

export default function EditScriptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [script, setScript] = useState<Script | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [talkingPoints, setTalkingPoints] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/dashboard/scripts/${id}`).then(r => r.json()),
      fetch("/api/dashboard/products").then(r => r.json()),
    ]).then(([s, p]) => {
      setScript(s);
      setTalkingPoints((s.talking_points ?? []).join("\n"));
      setProducts(p.products ?? []);
    }).catch(() => setError("Failed to load script"));
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setSaved(false); setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/dashboard/scripts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:           fd.get("name"),
          product_id:     fd.get("product_id") || null,
          talking_points: talkingPoints.split("\n").map(s => s.trim()).filter(Boolean),
          tone:           fd.get("tone"),
          is_default:     fd.get("is_default") === "on",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      setScript(data);
      setSaved(true);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!confirm("Delete this script? This cannot be undone.")) return;
    await fetch(`/api/dashboard/scripts/${id}`, { method: "DELETE" });
    router.push("/dashboard/scripts");
  }

  if (!script) return <div className="p-8 text-gray-500 text-sm">Loading…</div>;

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Edit script</h1>
        <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-300">Delete</button>
      </div>
      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Script name</label>
          <input name="name" type="text" required defaultValue={script.name} className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        {products.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Product</label>
            <select name="product_id" defaultValue={script.product_id ?? ""} className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— no product —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Narration tone</label>
          <select name="tone" defaultValue={script.tone} className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="confident">Confident</option>
            <option value="friendly">Friendly</option>
            <option value="urgent">Urgent</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Key talking points <span className="text-gray-500">(one per line)</span></label>
          <textarea value={talkingPoints} onChange={e => setTalkingPoints(e.target.value)} rows={7} className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" name="is_default" id="is_default" defaultChecked={script.is_default} className="rounded border-gray-600" />
          <label htmlFor="is_default" className="text-sm text-gray-300">Set as default script for new video jobs</label>
        </div>

        {error && <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg px-3.5 py-2.5">{error}</p>}
        {saved && <p className="text-sm text-green-400 bg-green-950/40 border border-green-800/50 rounded-lg px-3.5 py-2.5">Saved successfully</p>}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.push("/dashboard/scripts")} className="flex-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 text-sm transition-colors">Back</button>
          <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 text-sm transition-colors">{loading ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}
