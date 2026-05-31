"use client";

import { Suspense } from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";

interface Hotspot {
  id: string;
  startSeconds: number;
  endSeconds: number;
  label: string;
  targetUrl: string;
}

interface RenderData {
  cdnUrl: string;
  tenantName: string;
  tenantLogoUrl: string | null;
  brandColor: string;
  hotspots: Hotspot[];
  prospectName: string | null;
}

function WatchPageInner() {
  const { renderId } = useParams<{ renderId: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [data, setData] = useState<RenderData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [ctaClicks, setCtaClicks] = useState(0);
  const [replayCount, setReplayCount] = useState(0);
  const reportedMilestones = useRef(new Set<string>());

  useEffect(() => {
    if (!token) { setError("Invalid or missing access token."); setLoading(false); return; }
    fetch(`/api/video/watch/${renderId}?token=${token}`)
      .then(async r => {
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error ?? "Access denied"); }
        return r.json() as Promise<RenderData>;
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e instanceof Error ? e.message : "Failed to load"); setLoading(false); });
  }, [renderId, token]);

  const fireEvent = useCallback((eventType: string, extra?: Record<string, unknown>) => {
    void fetch("/api/video/playback-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ renderId, eventType, ...extra }),
    });
  }, [renderId]);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setCurrentTime(v.currentTime);
    const pct = (v.currentTime / v.duration) * 100;
    for (const milestone of [25, 50, 75]) {
      const key = `progress_${milestone}`;
      if (pct >= milestone && !reportedMilestones.current.has(key)) {
        reportedMilestones.current.add(key);
        fireEvent("video_progress", { playbackSeconds: v.currentTime, metadata: { milestone } });
      }
    }
  }, [fireEvent]);

  const handleEnded = useCallback(() => {
    const v = videoRef.current;
    const duration = v?.duration ?? 0;
    fireEvent("video_completed", {
      playbackSeconds: duration,
      metadata: { watchPercent: 100, ctaClicks, replayCount },
    });
  }, [fireEvent, ctaClicks, replayCount]);

  const handlePlay = useCallback(() => {
    const v = videoRef.current;
    if (v && v.currentTime < 1) fireEvent("video_started");
  }, [fireEvent]);

  const handleSeeked = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    // Count as replay if seeking back to near start
    if (v.currentTime < 2) setReplayCount(c => c + 1);
  }, []);

  const handleHotspotClick = useCallback((hotspot: Hotspot) => {
    setCtaClicks(c => c + 1);
    fireEvent("hotspot_click", { metadata: { hotspotId: hotspot.id, label: hotspot.label, targetUrl: hotspot.targetUrl } });
    window.open(hotspot.targetUrl, "_blank", "noopener,noreferrer");
  }, [fireEvent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-2">{error ?? "Video not found"}</p>
          <p className="text-gray-600 text-xs">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const activeHotspots = data.hotspots.filter(
    h => currentTime >= h.startSeconds && currentTime <= h.endSeconds
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center gap-3 border-b border-gray-900">
        {data.tenantLogoUrl ? (
          <img src={data.tenantLogoUrl} alt={data.tenantName} className="h-7 object-contain" />
        ) : (
          <span className="text-sm font-semibold text-white">{data.tenantName}</span>
        )}
        {data.prospectName && (
          <span className="ml-auto text-xs text-gray-500">Personalized for {data.prospectName}</span>
        )}
      </header>

      {/* Player */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl">
          <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl aspect-video">
            <video
              ref={videoRef}
              src={data.cdnUrl}
              controls
              className="w-full h-full"
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              onPlay={handlePlay}
              onSeeked={handleSeeked}
              style={{ "--accent": data.brandColor } as React.CSSProperties}
            />

            {/* Hotspot overlays */}
            {activeHotspots.map(hotspot => (
              <button
                key={hotspot.id}
                onClick={() => handleHotspotClick(hotspot)}
                className="absolute bottom-16 right-4 z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-lg transition-all hover:scale-105 active:scale-95"
                style={{ backgroundColor: data.brandColor }}
              >
                <span>{hotspot.label}</span>
                <span>→</span>
              </button>
            ))}
          </div>

          {/* CTA section */}
          <div className="mt-8 bg-gray-900 rounded-xl border border-gray-800 p-6 text-center">
            <h2 className="text-lg font-semibold text-white mb-2">Ready to get started?</h2>
            <p className="text-sm text-gray-400 mb-5">
              See how {data.tenantName} can work for your team.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <a
                href="mailto:sales@example.com"
                onClick={() => { setCtaClicks(c => c + 1); fireEvent("cta_click", { metadata: { ctaType: "book_call" } }); }}
                className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors hover:opacity-90"
                style={{ backgroundColor: data.brandColor }}
              >
                Book a call
              </a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setCtaClicks(c => c + 1); fireEvent("cta_click", { metadata: { ctaType: "start_trial" } }); }}
                className="px-5 py-2.5 rounded-lg border border-gray-700 text-gray-300 text-sm font-semibold hover:border-gray-500 transition-colors"
              >
                Start free trial
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* DemoForge credit */}
      <footer className="py-5 text-center border-t border-gray-900">
        <a
          href="https://demoforge.bioloopnexus.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-600 transition-colors hover:text-gray-400"
        >
          Made with DemoForge
        </a>
      </footer>
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <WatchPageInner />
    </Suspense>
  );
}
