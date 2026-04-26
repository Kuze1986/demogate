/**
 * PostgREST returns this when a relation is not exposed or not present in the API schema cache.
 * Often means the SQL migration that creates the table was not applied on this project.
 */
export function isPostgrestTableMissingError(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error?.message) return false;
  const m = error.message.toLowerCase();
  if (m.includes("schema cache")) return true;
  if (m.includes("could not find the table")) return true;
  if (m.includes("relation") && m.includes("does not exist")) return true;
  const c = error.code ?? "";
  return c === "PGRST205" || c === "42P01";
}
