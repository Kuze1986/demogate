import { revalidatePath } from "next/cache";
import { MissingSchemaBanner } from "@/components/admin/MissingSchemaBanner";
import { createJourneyTemplate } from "@/lib/admin-actions";
import { isPostgrestTableMissingError } from "@/lib/supabase/postgrest-errors";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

async function createTemplateAction(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) {
    throw new Error("Name is required");
  }
  await createJourneyTemplate({ tenantId: null, name, description: description || null });
  revalidatePath("/admin/tracks/templates");
}

export default async function JourneyTemplatesPage() {
  const svc = createServiceSupabaseClient();

  const { data: templates, error } = await svc
    .from("journey_templates")
    .select("*")
    .order("created_at", { ascending: false });

  const tablesMissing = Boolean(error && isPostgrestTableMissingError(error));
  if (error && !tablesMissing) {
    throw new Error(error.message);
  }

  const list = (templates ?? []) as Record<string, unknown>[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Journey templates</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Reusable journey shells for multi-track programs. Runtime wiring to tracks can
          evolve from these catalog entries.
        </p>
      </div>

      {tablesMissing && (
        <MissingSchemaBanner tables={["demoforge.journey_templates"]} />
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Create template</h2>
        {tablesMissing ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Create template is unavailable until the journey tables exist in Supabase.
          </p>
        ) : (
        <form action={createTemplateAction} className="mt-4 flex flex-col gap-3">
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-zinc-500">Name</span>
            <input
              name="name"
              required
              className="mt-1 w-full rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              Description
            </span>
            <textarea
              name="description"
              className="mt-1 min-h-[90px] w-full rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-2 text-sm"
            />
          </label>
          <Button type="submit" variant="primary">
            Save template
          </Button>
        </form>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Catalog</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {list.map((t) => (
            <li
              key={t.id as string}
              className="rounded-xl border border-[color:var(--panel-border)] px-3 py-2"
            >
              <p className="font-medium">{t.name as string}</p>
              {t.description ? (
                <p className="mt-1 text-xs text-zinc-500">{t.description as string}</p>
              ) : null}
            </li>
          ))}
          {list.length === 0 && !tablesMissing && (
            <li className="text-zinc-500">No templates yet — create one above.</li>
          )}
          {list.length === 0 && tablesMissing && (
            <li className="text-zinc-500">No catalog until migrations are applied.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
