import type { JourneyEdgeCondition, JourneyEdgeRow, JourneyNodeRow } from "@/types/journey";

function parseCondition(raw: unknown): JourneyEdgeCondition {
  if (raw == null) return null;
  if (typeof raw !== "object") return { kind: "default" };
  const o = raw as Record<string, unknown>;
  if (o.kind === "meta_match" && typeof o.key === "string" && typeof o.value === "string") {
    return { kind: "meta_match", key: o.key, value: o.value };
  }
  if (o.kind === "default") return { kind: "default" };
  return null;
}

function matchesCondition(
  condition: JourneyEdgeCondition,
  decisionMeta: Record<string, unknown> | null | undefined
): boolean {
  if (condition == null || condition.kind === "default") {
    return true;
  }
  if (condition.kind === "meta_match") {
    if (!decisionMeta) return false;
    const v = decisionMeta[condition.key];
    return String(v ?? "") === condition.value;
  }
  return false;
}

/**
 * Deterministic branch selection: lowest priority number wins among eligible edges.
 */
export function pickNextNodeId(input: {
  edges: JourneyEdgeRow[];
  currentNodeId: string;
  decisionMetadata?: Record<string, unknown> | null;
}): string | null {
  const outgoing = input.edges
    .filter((e) => e.from_node_id === input.currentNodeId)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  const meta = input.decisionMetadata ?? null;

  const conditional = outgoing.filter((e) => {
    const c = parseCondition(e.condition);
    return c != null && c.kind === "meta_match";
  });
  for (const e of conditional) {
    const c = parseCondition(e.condition);
    if (c && matchesCondition(c, meta)) {
      return e.to_node_id;
    }
  }

  const defaults = outgoing.filter((e) => {
    const c = parseCondition(e.condition);
    return c == null || c.kind === "default";
  });
  if (defaults.length > 0) {
    return defaults[0].to_node_id;
  }

  if (outgoing.length > 0) {
    return outgoing[0].to_node_id;
  }
  return null;
}

export function moduleIdForNode(
  nodes: JourneyNodeRow[],
  nodeId: string | null
): string | null {
  if (!nodeId) return null;
  const n = nodes.find((x) => x.id === nodeId);
  return (n?.module_id as string | null) ?? null;
}

export function initialGraphNodeId(input: {
  entryNodeId: string | null;
  nodes: JourneyNodeRow[];
  currentModuleId: string | null;
}): string | null {
  if (!input.nodes.length) return null;
  if (input.entryNodeId && input.nodes.some((n) => n.id === input.entryNodeId)) {
    if (input.currentModuleId) {
      const match = input.nodes.find((n) => n.module_id === input.currentModuleId);
      if (match) return match.id;
    }
    return input.entryNodeId;
  }
  if (input.currentModuleId) {
    const match = input.nodes.find((n) => n.module_id === input.currentModuleId);
    if (match) return match.id;
  }
  const firstWithModule = input.nodes.find((n) => n.module_id);
  return firstWithModule?.id ?? input.nodes[0]?.id ?? null;
}
