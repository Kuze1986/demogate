"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { VideoDeviceProfile, VideoVariantType } from "@/lib/video/types";

interface SessionOption {
  id: string;
  label: string;
}

interface ManualDemoControlPanelProps {
  sessions: SessionOption[];
}

const variantOptions: VideoVariantType[] = [
  "default",
  "hook_a",
  "hook_b",
  "cta_a",
  "cta_b",
  "localized_es",
  "mobile",
];

const deviceOptions: VideoDeviceProfile[] = ["desktop", "mobile"];

export function ManualDemoControlPanel({ sessions }: ManualDemoControlPanelProps) {
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [manualSessionId, setManualSessionId] = useState("");
  const [priority, setPriority] = useState(80);
  const [locale, setLocale] = useState("en");
  const [selectedVariants, setSelectedVariants] = useState<VideoVariantType[]>(["default"]);
  const [selectedDevices, setSelectedDevices] = useState<VideoDeviceProfile[]>(["desktop"]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolvedSessionId = useMemo(
    () => manualSessionId.trim() || sessionId,
    [manualSessionId, sessionId]
  );

  async function handleTrigger() {
    setError(null);
    setResult(null);
    if (!resolvedSessionId) {
      setError("Pick a session or enter a session ID.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/manual-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: resolvedSessionId,
          variants: selectedVariants,
          deviceProfiles: selectedDevices,
          locale: locale.trim() || "en",
          priority,
        }),
      });
      const data = (await response.json()) as
        | { ok: true; videoJobId: string; correlationId: string }
        | { error?: string };
      if (!response.ok) {
        throw new Error(data && "error" in data ? data.error ?? "Trigger failed" : "Trigger failed");
      }
      if ("ok" in data && data.ok) {
        setResult(`Triggered job ${data.videoJobId.slice(0, 8)} (corr ${data.correlationId.slice(0, 8)}).`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trigger failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleVariant(variant: VideoVariantType) {
    setSelectedVariants((prev) =>
      prev.includes(variant) ? prev.filter((x) => x !== variant) : [...prev, variant]
    );
  }

  function toggleDevice(device: VideoDeviceProfile) {
    setSelectedDevices((prev) =>
      prev.includes(device) ? prev.filter((x) => x !== device) : [...prev, device]
    );
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Manual Demo Trigger</h2>
        <p className="mt-1 text-sm soft-muted">
          Queue a video run for an existing demo session without waiting for intake automation.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="soft-muted">Recent session</span>
          <select
            className="glass rounded-xl border border-[color:var(--panel-border)] px-3 py-2"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          >
            <option value="">Select session</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="soft-muted">Session ID (manual override)</span>
          <input
            className="glass rounded-xl border border-[color:var(--panel-border)] px-3 py-2"
            value={manualSessionId}
            onChange={(e) => setManualSessionId(e.target.value)}
            placeholder="UUID session id"
          />
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="soft-muted">Locale</span>
          <input
            className="glass rounded-xl border border-[color:var(--panel-border)] px-3 py-2"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="soft-muted">Priority</span>
          <input
            className="glass rounded-xl border border-[color:var(--panel-border)] px-3 py-2"
            type="number"
            min={1}
            max={999}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value) || 80)}
          />
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm soft-muted">Variants</p>
          <div className="flex flex-wrap gap-2">
            {variantOptions.map((variant) => (
              <button
                key={variant}
                type="button"
                onClick={() => toggleVariant(variant)}
                className={`rounded-lg border px-2 py-1 text-xs ${
                  selectedVariants.includes(variant)
                    ? "border-[color:var(--accent)] bg-[rgba(44,247,223,0.14)]"
                    : "border-[color:var(--panel-border)]"
                }`}
              >
                {variant}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm soft-muted">Device profiles</p>
          <div className="flex flex-wrap gap-2">
            {deviceOptions.map((device) => (
              <button
                key={device}
                type="button"
                onClick={() => toggleDevice(device)}
                className={`rounded-lg border px-2 py-1 text-xs ${
                  selectedDevices.includes(device)
                    ? "border-[color:var(--accent)] bg-[rgba(44,247,223,0.14)]"
                    : "border-[color:var(--panel-border)]"
                }`}
              >
                {device}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleTrigger}
          disabled={
            isSubmitting || selectedVariants.length === 0 || selectedDevices.length === 0
          }
        >
          {isSubmitting ? "Triggering..." : "Trigger manual demo"}
        </Button>
        {result ? <p className="text-sm text-[color:var(--accent-2)]">{result}</p> : null}
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>
    </Card>
  );
}
