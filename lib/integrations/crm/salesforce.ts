import { logSystemEvent } from "@/lib/logging";

export interface SalesforceLeadInput {
  email: string;
  company?: string | null;
  title?: string | null;
}

/**
 * Stub adapter — wire `SALESFORCE_INSTANCE_URL` + OAuth client when ready.
 */
export async function salesforceUpsertLeadStub(input: SalesforceLeadInput): Promise<void> {
  if (!process.env.SALESFORCE_INSTANCE_URL) {
    await logSystemEvent({
      function_name: "crm.salesforce.stub",
      status: "success",
      message: "Skipped: SALESFORCE_INSTANCE_URL not configured",
      payload: { email: input.email },
    });
    return;
  }
  await logSystemEvent({
    function_name: "crm.salesforce.stub",
    status: "success",
    message: "Salesforce adapter not fully implemented — instance URL present",
    payload: { email: input.email },
  });
}
