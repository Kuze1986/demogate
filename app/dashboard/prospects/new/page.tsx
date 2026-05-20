"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewProspectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generateVideo, setGenerateVideo] = useState(true);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    try {
      // Create prospect
      const prospectRes = await fetch("/api/dashboard/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName:    fd.get("firstName"),
          lastName:     fd.get("lastName"),
          email:        fd.get("email"),
          organization: fd.get("organization"),
          role:         fd.get("role"),
          pain_points:  String(fd.get("painPoints") ?? "").split("\n").map(s => s.trim()).filter(Boolean),
        }),
      });
      const prospect = await prospectRes.json();
      if (!prospectRes.ok) { setError(prospect.error ?? "Failed to create prospect"); return; }

      if (generateVideo) {
        const videoRes = await fetch(`/api/dashboard/prospects/${prospect.id}/generate-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const videoData = await videoRes.json();
        if (!videoRes.ok) {
          if (videoRes.status === 402) {
            setError(videoData.error);
            return;
          }
          // Non-fatal — still navigate to prospect page
          console.warn("Video generation failed:", videoData.error);
        } else {
          router.push(`/dashboard/videos/${videoData.videoJobId}`);
          return;
        }
      }
      router.push(`/dashboard/prospects/${prospect.id}`);
    } catch { setError("Network error — please try again"); }
    finally { setLoading(false); }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Add prospect</h1>
      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">First name</label>
            <input name="firstName" type="text" placeholder="Ada" className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Last name</label>
            <input name="lastName" type="text" placeholder="Lovelace" className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Email <span className="text-red-400">*</span></label>
          <input name="email" type="email" required placeholder="ada@acme.com" className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Company</label>
            <input name="organization" type="text" placeholder="Acme Corp" className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Role / title</label>
            <input name="role" type="text" placeholder="VP of Sales" className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Pain points <span className="text-gray-500">(one per line, optional)</span></label>
          <textarea name="painPoints" rows={3} placeholder={"e.g.:\nManual reporting takes too long\nSales cycle is 90+ days"} className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          <p className="text-xs text-gray-500 mt-1">AI will personalize the narration to address these pain points.</p>
        </div>

        <div className="flex items-center gap-2 bg-indigo-950/30 border border-indigo-900/50 rounded-lg p-3.5">
          <input type="checkbox" id="generateVideo" checked={generateVideo} onChange={e => setGenerateVideo(e.target.checked)} className="rounded border-gray-600" />
          <label htmlFor="generateVideo" className="text-sm text-gray-200">Generate personalized demo video immediately</label>
        </div>

        {error && <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg px-3.5 py-2.5">{error}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="flex-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 text-sm transition-colors">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 text-sm transition-colors">
            {loading ? (generateVideo ? "Adding & generating…" : "Adding…") : (generateVideo ? "Add & generate video" : "Add prospect")}
          </button>
        </div>
      </form>
    </div>
  );
}
