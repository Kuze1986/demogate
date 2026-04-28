"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createJourneyEdge,
  createJourneyNode,
  deleteJourneyEdge,
  deleteJourneyNode,
  setTrackEntryNode,
} from "@/lib/admin-actions";
import type { DemoModuleRow } from "@/types/demo";
import type { JourneyEdgeRow, JourneyNodeRow } from "@/types/journey";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function JourneyBuilder({
  trackId,
  entryNodeId,
  modules,
  nodes,
  edges,
}: {
  trackId: string;
  entryNodeId: string | null;
  modules: DemoModuleRow[];
  nodes: JourneyNodeRow[];
  edges: JourneyEdgeRow[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [priority, setPriority] = useState<string>("100");
  const [conditionJson, setConditionJson] = useState<string>("");

  const nodeOptions = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        label:
          n.label ??
          modules.find((m) => m.id === n.module_id)?.title ??
          n.id.slice(0, 8),
      })),
    [modules, nodes]
  );

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Journey graph</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Map modules to nodes, connect edges with optional JSON conditions such as{" "}
          <code className="rounded bg-black/5 px-1 py-0.5 text-xs dark:bg-white/10">
            {`{"kind":"meta_match","key":"branch","value":"a"}`}
          </code>
          . Lowest priority number is evaluated first among meta matches, then defaults.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Entry node</p>
          <div className="flex flex-wrap items-end gap-2">
            <select
              className="rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-2 text-sm"
              value={entryNodeId ?? ""}
              onChange={(e) => {
                const v = e.target.value || null;
                startTransition(() => {
                  setError(null);
                  setTrackEntryNode(trackId, v)
                    .then(() => {})
                    .catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : String(err));
                    });
                });
              }}
              disabled={pending}
            >
              <option value="">Not set (linear demo)</option>
              {nodeOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>

          <p className="mt-4 text-sm font-medium">Nodes</p>
          <div className="flex flex-wrap gap-2">
            <select
              className="min-w-[200px] rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-2 text-sm"
              value={selectedModuleId}
              onChange={(e) => setSelectedModuleId(e.target.value)}
            >
              <option value="">New node without module</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(() => {
                  setError(null);
                  createJourneyNode(
                    trackId,
                    selectedModuleId ? selectedModuleId : null
                  )
                    .then(() => {})
                    .catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : String(err));
                    });
                })
              }
            >
              Add node
            </Button>
          </div>

          <ul className="mt-2 space-y-2 text-sm">
            {nodes.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--panel-border)] px-3 py-2"
              >
                <span>
                  {(n.label ?? "Node") +
                    " · " +
                    (modules.find((m) => m.id === n.module_id)?.title ?? "no module")}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-600"
                  disabled={pending}
                  onClick={() =>
                    startTransition(() => {
                      setError(null);
                      deleteJourneyNode(n.id, trackId)
                        .then(() => {})
                        .catch((err: unknown) => {
                          setError(err instanceof Error ? err.message : String(err));
                        });
                    })
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Edges</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs soft-muted">
              From
              <select
                className="mt-1 w-full rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-2 text-sm"
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
              >
                <option value="">Select node</option>
                {nodeOptions.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs soft-muted">
              To
              <select
                className="mt-1 w-full rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-2 text-sm"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
              >
                <option value="">Select node</option>
                {nodeOptions.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-xs soft-muted">
            Priority (lower runs first for meta matches)
            <input
              className="mt-1 w-full rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-2 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </label>
          <label className="text-xs soft-muted">
            Condition JSON (optional)
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-2 font-mono text-xs"
              value={conditionJson}
              onChange={(e) => setConditionJson(e.target.value)}
              placeholder='{"kind":"default"}'
            />
          </label>
          <Button
            type="button"
            disabled={pending || !fromId || !toId}
            onClick={() =>
              startTransition(() => {
                setError(null);
                let condition: Record<string, unknown> | null = null;
                if (conditionJson.trim()) {
                  try {
                    condition = JSON.parse(conditionJson) as Record<string, unknown>;
                  } catch {
                    setError("Condition JSON is invalid");
                    return;
                  }
                }
                const pr = Number.parseInt(priority, 10);
                createJourneyEdge(trackId, fromId, toId, Number.isFinite(pr) ? pr : 100, condition)
                  .then(() => {
                    setConditionJson("");
                  })
                  .catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : String(err));
                  });
              })
            }
          >
            Add edge
          </Button>

          <ul className="mt-2 space-y-2 text-sm">
            {edges.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--panel-border)] px-3 py-2"
              >
                <span className="break-all">
                  {e.from_node_id.slice(0, 6)} → {e.to_node_id.slice(0, 6)} · p
                  {e.priority}{" "}
                  {e.condition ? JSON.stringify(e.condition) : "∅"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-600"
                  disabled={pending}
                  onClick={() =>
                    startTransition(() => {
                      setError(null);
                      deleteJourneyEdge(e.id, trackId)
                        .then(() => {})
                        .catch((err: unknown) => {
                          setError(err instanceof Error ? err.message : String(err));
                        });
                    })
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
