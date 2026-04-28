import { logSystemEvent } from "@/lib/logging";

export interface LogVideoOperationInput {
  operation: string;
  status: "success" | "error";
  sessionId?: string | null;
  correlationId?: string;
  message?: string;
  payload?: Record<string, unknown> | null;
}

export async function logVideoOperation(input: LogVideoOperationInput): Promise<void> {
  await logSystemEvent({
    function_name: `video_${input.operation}`,
    session_id: input.sessionId ?? null,
    status: input.status,
    message: input.message ?? null,
    payload: {
      correlation_id: input.correlationId ?? null,
      ...(input.payload ?? {}),
    },
  });
}
