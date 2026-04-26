import { Card } from "@/components/ui/Card";

export function MissingSchemaBanner({ tables }: { tables: string[] }) {
  const list = tables.join(", ");
  return (
    <Card className="mb-6 border border-amber-500/40 bg-amber-50/60 p-4 text-sm text-amber-950 dark:bg-amber-950/25 dark:text-amber-50">
      <p className="font-semibold">Database tables not available</p>
      <p className="mt-2 text-pretty">
        Supabase/PostgREST cannot see: <span className="font-mono text-xs">{list}</span>. This
        usually means the platform migration that creates them has not been applied on this
        project yet.
      </p>
      <p className="mt-3 text-xs leading-relaxed text-amber-900/90 dark:text-amber-100/90">
        Apply{" "}
        <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono dark:bg-white/10">
          supabase/migrations/20260431_platform_tables_if_missing.sql
        </code>{" "}
        (or the full{" "}
        <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono dark:bg-white/10">
          20260426_billing_and_platform.sql
        </code>
        ). In the Supabase dashboard, confirm the demoforge schema is exposed to the Data API
        (Settings → API → Exposed schemas), then reload the app.
      </p>
    </Card>
  );
}
