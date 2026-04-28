import { logSystemEvent } from "@/lib/logging";

export interface HubspotUpsertInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
}

/**
 * Stub adapter — wire `HUBSPOT_PRIVATE_APP_TOKEN` + Contacts API when ready.
 */
export async function hubspotUpsertContactStub(input: HubspotUpsertInput): Promise<void> {
  if (!process.env.HUBSPOT_PRIVATE_APP_TOKEN) {
    await logSystemEvent({
      function_name: "crm.hubspot.stub",
      status: "success",
      message: "Skipped: HUBSPOT_PRIVATE_APP_TOKEN not configured",
      payload: { email: input.email },
    });
    return;
  }
  await logSystemEvent({
    function_name: "crm.hubspot.stub",
    status: "success",
    message: "HubSpot adapter not fully implemented — token present",
    payload: { email: input.email },
  });
}
