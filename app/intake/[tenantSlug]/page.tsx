"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface TenantBranding {
  name: string;
  logoUrl: string | null;
  brandColor: string;
}

type Step = "form" | "submitting" | "complete" | "notfound";

export default function TenantIntakePage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/intake/${tenantSlug}/branding`)
      .then(async r => {
        if (r.status === 404) { setStep("notfound"); return null; }
        return r.json() as Promise<TenantBranding>;
      })
      .then(d => { if (d) setBranding(d); })
      .catch(() => setStep("notfound"));
  }, [tenantSlug]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStep("submitting");
    const fd = new FormData(e.currentTarget);
    const body = {
      tenantSlug,
      firstName:    fd.get("firstName") as string,
      lastName:     fd.get("lastName") as string,
      email:        fd.get("email") as string,
      organization: fd.get("organization") as string,
      role:         fd.get("role") as string,
      painPoints:   (fd.get("painPoints") as string).split("\n").map(s => s.trim()).filter(Boolean),
    };
    try {
      const res = await fetch(`/api/intake/${tenantSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Something went wrong"); setStep("form"); return; }
      setStep("complete");
    } catch { setError("Network error"); setStep("form"); }
  }

  const color = branding?.brandColor ?? "#6366f1";

  if (step === "notfound") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <p className="text-gray-500 text-sm">This demo link is invalid or has been removed.</p>
      </div>
    );
  }

  if (step === "complete") {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
        {branding?.logoUrl && <img src={branding.logoUrl} alt={branding.name} className="h-10 mb-8 object-contain" />}
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: `${color}33` }}>
          <svg className="w-6 h-6" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">You're all set!</h1>
        <p className="text-gray-400 text-sm max-w-sm">
          {branding?.name ?? "We"} are preparing your personalized video demo. You'll receive it by email shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-start px-4 py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        {branding?.logoUrl ? (
          <img src={branding.logoUrl} alt={branding.name} className="h-10 mx-auto mb-4 object-contain" />
        ) : branding ? (
          <p className="text-lg font-semibold text-white mb-4">{branding.name}</p>
        ) : null}
        <h1 className="text-2xl font-bold text-white">Get your personalized demo</h1>
        <p className="text-sm text-gray-500 mt-1">Fill in a few details and we'll create a video just for you.</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">First name</label>
            <input name="firstName" required className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Last name</label>
            <input name="lastName" required className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Work email</label>
          <input name="email" type="email" required className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Company</label>
          <input name="organization" required className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Your role</label>
          <input name="role" required placeholder="e.g. Head of Operations" className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            What challenges are you trying to solve? <span className="text-gray-600">(one per line)</span>
          </label>
          <textarea name="painPoints" rows={3} placeholder="e.g. Manual onboarding processes&#10;Lack of visibility into team performance" className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm placeholder-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        {error && <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={step === "submitting"}
          className="w-full py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition-colors hover:opacity-90"
          style={{ backgroundColor: color }}
        >
          {step === "submitting" ? "Creating your demo…" : "Get my personalized demo"}
        </button>
      </form>
    </div>
  );
}
