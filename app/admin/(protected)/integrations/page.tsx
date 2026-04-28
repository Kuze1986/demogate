import { revalidatePath } from "next/cache";
import { MissingSchemaBanner } from "@/components/admin/MissingSchemaBanner";
import { registerIntegrationEndpoint } from "@/lib/admin-actions";
import { isPostgrestTableMissingError } from "@/lib/supabase/postgrest-errors";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

async function createEndpointAction(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const eventsRaw = String(formData.get("events") ?? "").trim();
  const secret = String(formData.get("secret") ?? "").trim();
  if (!name || !url) {
    throw new Error("Name and URL are required");
  }
  const eventFilter = eventsRaw
    ? eventsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  await registerIntegrationEndpoint({
    name,
    url,
    tenantId: null,
    eventFilter,
    secret: secret || null,
  });
  revalidatePath("/admin/integrations");
}

export default async function IntegrationsPage() {
  const svc = createServiceSupabaseClient();
  const { data: endpoints, error: e1 } = await svc
    .from("integration_endpoints")
    .select("*")
    .order("created_at", { ascending: false });
  const endpointsMissing = Boolean(e1 && isPostgrestTableMissingError(e1));
  if (e1 && !endpointsMissing) {
    throw new Error(e1.message);
  }

  const { data: deliveries, error: e2 } = await svc
    .from("integration_deliveries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(40);
  const deliveriesMissing = Boolean(e2 && isPostgrestTableMissingError(e2));
  if (e2 && !deliveriesMissing) {
    throw new Error(e2.message);
  }

  const epList = (endpointsMissing ? [] : endpoints) ?? [];
  const delList = (deliveriesMissing ? [] : deliveries) ?? [];
  const integrationGap = endpointsMissing || deliveriesMissing;
  const missingTables: string[] = [];
  if (endpointsMissing) missingTables.push("demoforge.integration_endpoints");
  if (deliveriesMissing) missingTables.push("demoforge.integration_deliveries");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Webhook catalog with delivery logging. Filters use exact event type strings such as{" "}
          <code className="rounded bg-black/5 px-1 py-0.5 text-xs dark:bg-white/10">
            demo.module_complete
          </code>
          .
        </p>
      </div>

      {integrationGap && <MissingSchemaBanner tables={missingTables} />}

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Register endpoint</h2>
        {integrationGap ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Register endpoint is unavailable until integration tables exist in Supabase.
          </p>
        ) : (
        <form action={createEndpointAction} className="mt-4 flex flex-col gap-3">
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-zinc-500">Name</span>
            <input
              name="name"
              required
              className="mt-1 w-full rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-zinc-500">URL</span>
            <input
              name="url"
              type="url"
              required
              className="mt-1 w-full rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              Event filter (comma-separated, empty = all)
            </span>
            <input
              name="events"
              className="mt-1 w-full rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-2 text-sm"
              placeholder="lead.created,demo.demo_complete"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              Shared secret (optional)
            </span>
            <input
              name="secret"
              className="mt-1 w-full rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-2 text-sm"
            />
          </label>
          <Button type="submit">Save endpoint</Button>
        </form>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Endpoints</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {epList.map((ep) => (
            <li
              key={ep.id as string}
              className="rounded-xl border border-[color:var(--panel-border)] px-3 py-2"
            >
              <p className="font-medium">{ep.name as string}</p>
              <p className="text-xs text-zinc-500">{ep.url as string}</p>
              <p className="text-xs text-zinc-500">
                filter:{" "}
                {Array.isArray(ep.event_filter) && ep.event_filter.length
                  ? (ep.event_filter as string[]).join(", ")
                  : "ALL"}
              </p>
            </li>
          ))}
          {epList.length === 0 && !integrationGap && (
            <li className="text-zinc-500">No endpoints configured yet.</li>
          )}
          {epList.length === 0 && integrationGap && (
            <li className="text-zinc-500">No data until migrations are applied.</li>
          )}
        </ul>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Recent deliveries</h2>
        <ul className="mt-4 space-y-2 text-xs">
          {delList.map((d) => (
            <li
              key={d.id as string}
              className="rounded-xl border border-[color:var(--panel-border)] px-3 py-2"
            >
              <span className="font-medium">{d.event_type as string}</span> ·{" "}
              <span>{d.status as string}</span> ·{" "}
              <span className="text-zinc-500">
                {(d.created_at as string | null) ?? ""}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
