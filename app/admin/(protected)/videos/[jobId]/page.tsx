import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export default async function AdminVideoJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const supabase = createServiceSupabaseClient();
  const { data: job, error } = await supabase
    .from("video_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error || !job) notFound();

  const { data: variants } = await supabase
    .from("video_variants")
    .select("*")
    .eq("video_job_id", jobId)
    .order("created_at", { ascending: false });

  const { data: renders } = await supabase
    .from("video_renders")
    .select("*")
    .eq("video_job_id", jobId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] soft-muted">Video Job</p>
        <h1 className="text-2xl font-semibold tabular-nums">{String(job.id)}</h1>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Job metadata</h2>
        <pre className="overflow-x-auto rounded-xl bg-black/30 p-3 text-xs text-emerald-100">
          {JSON.stringify(job, null, 2)}
        </pre>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Variants</h2>
        <pre className="overflow-x-auto rounded-xl bg-black/30 p-3 text-xs text-cyan-100">
          {JSON.stringify(variants ?? [], null, 2)}
        </pre>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Renders</h2>
        <pre className="overflow-x-auto rounded-xl bg-black/30 p-3 text-xs text-cyan-100">
          {JSON.stringify(renders ?? [], null, 2)}
        </pre>
      </Card>
    </div>
  );
}
