export async function checkCrucibleHealth(): Promise<boolean> {
  const baseUrl = process.env.CRUCIBLE_SIM_BASE_URL;
  if (!baseUrl) return false;

  const apiKey = process.env.CRUCIBLE_SIM_API_KEY;

  try {
    const response = await fetch(new URL("/api/health", baseUrl), {
      method: "GET",
      headers: {
        ...(apiKey ? { "x-bioloop-key": apiKey } : {}),
      },
      signal: AbortSignal.timeout(3_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
