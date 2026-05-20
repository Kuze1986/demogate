"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface RenderStatus {
  status: string;
  cdnUrl: string | null;
  renderId: string | null;
  accessToken: string | null;
  errorMessage: string | null;
  updatedAt: string;
}

const POLLING_INTERVAL_MS = 4000;

export default function VideoDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [status, setStatus] = useState<RenderStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/video/render-status/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setStatus(data);
          setLoading(false);
          // Stop polling once terminal
          if (["succeeded", "failed", "dead_letter", "cancelled"].includes(data.status)) return;
        }
      } catch { /* ignore */ }
      if (!cancelled) setTimeout(poll, POLLING_INTERVAL_MS);
    }

    poll();
    return () => { cancelled = true; };
  }, [jobId]);

  const watchUrl = status?.renderId && status?.accessToken
    ? `/watch/${status.renderId}?token=${status.accessToken}`
    : null;

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/dashboard/videos" className="text-xs text-gray-500 hover:text-gray-400 mb-4 inline-block">&larr; All videos</Link>
      <h1 className="text-2xl font-bold text-white mb-6">Video job</h1>
      <p className="font-mono text-xs text-gray-500 mb-6">{jobId}</p>

      {loading ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
          <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-400">Loading job status…</p>
        </div>
      ) : !status ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
          <p className="text-sm text-red-400">Job not found or access denied.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Status</span>
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                status.status === "succeeded"   ? "bg-green-900/50 text-green-400" :
                status.status === "running"     ? "bg-blue-900/50 text-blue-300"  :
                status.status === "failed" || status.status === "dead_letter" ? "bg-red-900/50 text-red-400" :
                "bg-gray-800 text-gray-400"
              }`}>
                {status.status}
              </span>
            </div>
            {["queued", "running"].includes(status.status) && (
              <div className="mt-4 flex items-center gap-2">
                <div className="inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-500">
                  {status.status === "queued" ? "Waiting in queue…" : "Rendering video with AI narration…"}
                </span>
              </div>
            )}
            {status.errorMessage && (
              <p className="mt-3 text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded p-2">{status.errorMessage}</p>
            )}
          </div>

          {status.status === "succeeded" && (
            <>
              {status.cdnUrl && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                  <p className="text-sm font-medium text-gray-300 mb-3">Video preview</p>
                  <video
                    src={status.cdnUrl}
                    controls
                    className="w-full rounded-lg bg-black"
                    style={{ maxHeight: "360px" }}
                  />
                </div>
              )}

              {watchUrl && (
                <div className="bg-gray-900 rounded-xl border border-indigo-900/50 p-5">
                  <p className="text-sm font-medium text-gray-300 mb-1">Shareable prospect link</p>
                  <p className="text-xs text-gray-500 mb-3">Send this to your prospect — they can watch the video without logging in.</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-indigo-300 bg-gray-800 rounded px-3 py-2 truncate">
                      {typeof window !== "undefined" ? `${window.location.origin}${watchUrl}` : watchUrl}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}${watchUrl}`)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <Link href={watchUrl} target="_blank" className="mt-3 inline-block text-xs text-indigo-400 hover:text-indigo-300 underline">
                    Open player &rarr;
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
