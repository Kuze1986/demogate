"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "product" | "script" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("product");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [productId, setProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [productDesc, setProductDesc] = useState("");

  async function handleCreateProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: productName, base_url: productUrl, description: productDesc }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create product");
        return;
      }
      setProductId(data.id);
      setStep("script");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateScript(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/dashboard/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          name: fd.get("scriptName"),
          steps: [],
          talking_points: String(fd.get("talkingPoints") ?? "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          tone: fd.get("tone"),
          is_default: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create script");
        return;
      }
      setStep("done");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {(["product", "script", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s
                    ? "bg-indigo-600 text-white"
                    : (["product", "script", "done"].indexOf(step) > i
                      ? "bg-indigo-900 text-indigo-300"
                      : "bg-gray-800 text-gray-500")
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && <div className="flex-1 h-px bg-gray-800 w-8" />}
            </div>
          ))}
          <span className="ml-2 text-sm text-gray-400">
            {step === "product" ? "Add your product" : step === "script" ? "Set up your script" : "All set!"}
          </span>
        </div>

        {step === "product" && (
          <form onSubmit={handleCreateProduct} className="bg-gray-900 rounded-2xl p-8 border border-gray-800 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-white">Add your product</h2>
              <p className="text-sm text-gray-400 mt-1">
                DemoForge will record a demo of your product and add AI voiceover narration.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Product name</label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Acme CRM"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Product URL</label>
              <input
                type="url"
                required
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://app.acme.com"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                The URL your demo will start from. Make sure it&apos;s publicly accessible or provide credentials in your script steps.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Short description <span className="text-gray-500">(optional)</span></label>
              <input
                type="text"
                value={productDesc}
                onChange={(e) => setProductDesc(e.target.value)}
                placeholder="e.g. CRM for sales teams"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg px-3.5 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 text-sm transition-colors"
            >
              {loading ? "Saving…" : "Continue"}
            </button>
          </form>
        )}

        {step === "script" && (
          <form onSubmit={handleCreateScript} className="bg-gray-900 rounded-2xl p-8 border border-gray-800 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-white">Set up your demo script</h2>
              <p className="text-sm text-gray-400 mt-1">
                Enter your key talking points. AI will turn these into narration for each step of your demo video.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Script name</label>
              <input
                name="scriptName"
                type="text"
                required
                defaultValue={`${productName} — Default Demo`}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Key talking points</label>
              <textarea
                name="talkingPoints"
                required
                rows={6}
                placeholder={"One talking point per line, e.g.:\nSaves sales reps 3 hours per week\nNative CRM integration with Salesforce\nAI-powered lead scoring built in"}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <p className="mt-1.5 text-xs text-gray-500">AI will weave these into the voiceover narration as it walks through your product.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Narration tone</label>
              <select
                name="tone"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="confident">Confident — authoritative, clear, results-focused</option>
                <option value="friendly">Friendly — warm, conversational, approachable</option>
                <option value="urgent">Urgent — high-energy, problem-solution framing</option>
                <option value="neutral">Neutral — factual, informative, low-pressure</option>
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg px-3.5 py-2.5">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("product")}
                className="flex-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 text-sm transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-2 flex-grow rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 text-sm transition-colors"
              >
                {loading ? "Saving…" : "Save and continue"}
              </button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center space-y-6">
            <div className="w-14 h-14 rounded-full bg-green-900/40 border border-green-700/50 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Workspace ready</h2>
              <p className="text-sm text-gray-400 mt-2">
                Your product and script are set up. Add a prospect and generate your first demo video.
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 text-sm transition-colors"
            >
              Go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
