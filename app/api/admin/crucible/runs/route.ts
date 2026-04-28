import { NextResponse } from "next/server";
import { canAccessAdminPanel } from "@/lib/governance/policy";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

interface CrucibleRunOption {
  id: string;
  label: string;
}

function normalizeRunOptions(raw: unknown): CrucibleRunOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : null;
      if (!id) return null;
      const name = typeof row.name === "string" ? row.name : null;
      const status = typeof row.status === "string" ? row.status : null;
      const createdAt =
        typeof row.created_at === "string"
          ? row.created_at
          : typeof row.createdAt === "string"
            ? row.createdAt
            : null;
      const label = [name, status, createdAt].filter(Boolean).join(" · ") || id;
      return { id, label };
    })
    .filter((x): x is CrucibleRunOption => Boolean(x));
}

export async function GET() {
  const serverSupabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceSupabaseClient();
  const allowed = await canAccessAdminPanel(svc, {
    id: user.id,
    email: user.email,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.CRUCIBLE_SIM_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json({ runs: [] });
  }

  const apiKey = process.env.CRUCIBLE_SIM_API_KEY;
  const runsPath = process.env.CRUCIBLE_SIM_RUNS_PATH ?? "/api/crucible/runs";
  try {
    const response = await fetch(new URL(runsPath, baseUrl), {
      method: "GET",
      headers: {
        ...(apiKey ? { "x-bioloop-key": apiKey } : {}),
      },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      return NextResponse.json({ runs: [] });
    }
    const payload = (await response.json()) as { runs?: unknown } | unknown;
    const rows =
      payload && typeof payload === "object" && "runs" in payload
        ? (payload as { runs?: unknown }).runs
        : payload;
    return NextResponse.json({ runs: normalizeRunOptions(rows) });
  } catch {
    return NextResponse.json({ runs: [] });
  }
}

