import { logSystemEvent } from "@/lib/logging";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { deliverOutboundWebhook } from "@/lib/integrations/webhooks";

export interface IntegrationDispatchInput {
  tenantId?: string | null;
  eventType: string;
  idempotencyKey?: string | null;
  body: Record<string, unknown>;
}

/**
 * Fan-out to configured integration endpoints filtered by `event_filter`.
 */
export async function dispatchIntegrationEvent(input: IntegrationDispatchInput): Promise<void> {
  try {
    const supabase = createServiceSupabaseClient();
    let q = supabase
      .from("integration_endpoints")
      .select("id, url, secret, event_filter, tenant_id, enabled")
      .eq("enabled", true);
    if (input.tenantId) {
      q = q.or(`tenant_id.eq.${input.tenantId},tenant_id.is.null`);
    }
    const { data: endpoints, error } = await q;
    if (error) {
      throw new Error(error.message);
    }
    for (const ep of endpoints ?? []) {
      const filter = (ep.event_filter as string[] | null) ?? [];
      if (filter.length > 0 && !filter.includes(input.eventType)) {
        continue;
      }
      await deliverOutboundWebhook({
        endpointId: ep.id as string,
        url: ep.url as string,
        secret: (ep.secret as string | null) ?? null,
        payload: {
          eventType: input.eventType,
          idempotencyKey: input.idempotencyKey ?? null,
          body: input.body,
        },
      });
    }
    await logSystemEvent({
      function_name: "integrations.dispatch",
      status: "success",
      message: input.eventType,
      payload: { tenantId: input.tenantId ?? null },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logSystemEvent({
      function_name: "integrations.dispatch",
      status: "error",
      message,
      payload: { eventType: input.eventType },
    });
  }
}
