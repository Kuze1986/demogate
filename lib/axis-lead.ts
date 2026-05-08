import { createClient } from "@supabase/supabase-js";
import { observe } from "@/lib/ilita";
import { PRODUCT_LABELS } from "@/lib/constants";
import { logSystemEvent } from "@/lib/logging";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { ProductKey } from "@/types/demo";

/**
 * When `AXIS_URL` is set (feature flag / integration enabled), upsert a lead in
 * `axis.leads` on nexus-core and record a `lead_touches` row. Errors are logged;
 * callers must not depend on success.
 */
export async function writeLeadToAxisForSession(sessionId: string): Promise<void> {
  if (!process.env.AXIS_URL?.trim()) {
    return;
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null;
  const key =
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    null;
  if (!url || !key) {
    return;
  }

  try {
    const demoforge = createServiceSupabaseClient();
    const { data: session, error: sErr } = await demoforge
      .from("demo_sessions")
      .select("prospect_id, track_id")
      .eq("id", sessionId)
      .single();

    if (sErr || !session?.prospect_id || !session?.track_id) {
      return;
    }

    const { data: prospect, error: pErr } = await demoforge
      .from("prospects")
      .select("first_name, last_name, email, organization")
      .eq("id", session.prospect_id as string)
      .single();

    const { data: track, error: tErr } = await demoforge
      .from("demo_tracks")
      .select("product")
      .eq("id", session.track_id as string)
      .single();

    if (pErr || tErr || !prospect || !track) {
      return;
    }

    const productKey = track.product as ProductKey;
    const productLabel = PRODUCT_LABELS[productKey] ?? productKey;
    const name =
      `${prospect.first_name ?? ""} ${prospect.last_name ?? ""}`.trim() || "Unknown";
    const email = String(prospect.email ?? "").toLowerCase().trim();
    const org = String(prospect.organization ?? "");

    const root = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const touchedAt = new Date().toISOString();
    const createdAt = touchedAt;

    const { data: inserted, error: insErr } = await root
      .schema("axis")
      .from("leads")
      .insert({
        name,
        email,
        org,
        product: productLabel,
        stage: "contacted",
        source: "demoforge",
        created_at: createdAt,
      })
      .select("id")
      .maybeSingle();

    let leadId: string | null = inserted?.id ? String(inserted.id) : null;

    if (insErr && !leadId) {
      const { data: existing } = await root
        .schema("axis")
        .from("leads")
        .select("id")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      leadId = existing?.id ? String(existing.id) : null;
    }

    if (!leadId) {
      await logSystemEvent({
        function_name: "axis_lead_write",
        session_id: sessionId,
        status: "error",
        message: insErr?.message ?? "Axis lead insert returned no id",
      });
      return;
    }

    const { error: touchErr } = await root.schema("axis").from("lead_touches").insert({
      lead_id: leadId,
      channel: "demo",
      outcome: "demo_completed",
      notes: `Demo delivered via DemoForge for ${productLabel}`,
      touched_at: touchedAt,
    });

    if (touchErr) {
      await logSystemEvent({
        function_name: "axis_lead_touch",
        session_id: sessionId,
        status: "error",
        message: touchErr.message,
      });
      return;
    }

    await observe(
      "lead_written_to_axis",
      {
        product: productKey,
        prospect_email: email,
        session_id: sessionId,
        lead_id: leadId,
      },
      { significance: "high" }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logSystemEvent({
      function_name: "axis_lead_write",
      session_id: sessionId,
      status: "error",
      message,
    });
  }
}
