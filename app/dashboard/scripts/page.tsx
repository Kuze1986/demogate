import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ScriptsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signup");
  const ctx = await getCurrentTenant(user.id);
  if (!ctx) redirect("/onboarding");

  const svc = createServiceSupabaseClient();
  const { data: scripts } = await svc
    .from("demo_script_templates")
    .select("id,name,tone,is_default,talking_points,created_at")
    .eq("tenant_id", ctx.tenant.id)
    .order("created_at", { ascending: true });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Demo scripts</h1>
          <p className="text-sm text-gray-500 mt-1">Scripts define the steps and talking points for your AI-narrated demo videos.</p>
        </div>
        <Link href="/dashboard/scripts/new" className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 transition-colors">
          + New script
        </Link>
      </div>

      {!scripts?.length ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
          <p className="text-gray-500 text-sm">No scripts yet. Create your first demo script to start generating videos.</p>
          <Link href="/dashboard/scripts/new" className="mt-4 inline-block text-indigo-400 hover:text-indigo-300 text-sm underline">Create script</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {scripts.map((script) => (
            <div key={script.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white text-sm">{script.name}</p>
                  {script.is_default && (
                    <span className="text-xs bg-indigo-900/50 text-indigo-300 border border-indigo-800/50 rounded px-1.5 py-0.5">Default</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Tone: {script.tone} &nbsp;·&nbsp; {(script.talking_points as string[]).length} talking points
                </p>
              </div>
              <Link href={`/dashboard/scripts/${script.id}`} className="text-xs text-indigo-400 hover:text-indigo-300">
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
