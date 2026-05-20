"use client";

import { useEffect, useState } from "react";

interface Tenant {
  id: string; name: string; slug: string; logo_url: string | null;
  brand_color: string; elevenlabs_voice_id: string | null;
  plan: string; videos_limit: number; videos_used: number;
}

export default function SettingsPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/settings")
      .then(r => r.json())
      .then(d => setTenant(d.tenant))
      .catch(() => setError("Failed to load settings"));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setSaved(false); setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:                  fd.get("name"),
          brand_color:           fd.get("brand_color"),
          elevenlabs_voice_id:   fd.get("elevenlabs_voice_id") || null,
          logo_url:              fd.get("logo_url") || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      setTenant(data.tenant);
      setSaved(true);
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  if (!tenant) return <div className="p-8 text-sm text-gray-500">Loading…</div>;

  const intakeUrl = typeof window !== "undefined"
    ? `${window.location.origin}/intake/${tenant.slug}`
    : `/intake/${tenant.slug}`;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Workspace settings</h1>

      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Company name</label>
          <input name="name" type="text" required defaultValue={tenant.name} className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Logo URL <span className="text-gray-500">(optional)</span></label>
          <input name="logo_url" type="url" defaultValue={tenant.logo_url ?? ""} placeholder="https://example.com/logo.png" className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <p className="text-xs text-gray-500 mt-1">Displayed on the video player and emails sent to prospects.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Brand color</label>
          <div className="flex items-center gap-3">
            <input name="brand_color" type="color" defaultValue={tenant.brand_color} className="w-10 h-10 rounded border border-gray-700 bg-gray-800 cursor-pointer" />
            <span className="text-sm text-gray-400">{tenant.brand_color}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Used for buttons and accents in the video player and prospect emails.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">ElevenLabs voice ID <span className="text-gray-500">(optional)</span></label>
          <input name="elevenlabs_voice_id" type="text" defaultValue={tenant.elevenlabs_voice_id ?? ""} placeholder="Falls back to ELEVENLABS_DEFAULT_VOICE_ID" className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        {error && <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg px-3.5 py-2.5">{error}</p>}
        {saved && <p className="text-sm text-green-400 bg-green-950/40 border border-green-800/50 rounded-lg px-3.5 py-2.5">Settings saved</p>}

        <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 text-sm transition-colors">
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>

      {/* Intake link */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-sm font-semibold text-white mb-1">Shareable intake link</h2>
        <p className="text-xs text-gray-500 mb-3">
          Share this with prospects. They fill out the form and receive a personalized AI-narrated video demo.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs text-indigo-300 bg-gray-800 rounded px-3 py-2 truncate">{intakeUrl}</code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(intakeUrl)}
            className="text-xs text-indigo-400 hover:text-indigo-300 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded transition-colors"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}
