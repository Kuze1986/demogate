export interface JourneyNodeRow {
  id: string;
  track_id: string;
  module_id: string | null;
  label: string | null;
  node_type: string;
  position_x: number | null;
  position_y: number | null;
  metadata: Record<string, unknown> | null;
}

export interface JourneyEdgeRow {
  id: string;
  track_id: string;
  from_node_id: string;
  to_node_id: string;
  condition: Record<string, unknown> | null;
  priority: number;
}

export type JourneyEdgeCondition =
  | null
  | { kind: "default" }
  | { kind: "meta_match"; key: string; value: string };
