import { NextResponse } from "next/server";
import { logSystemEvent } from "@/lib/logging";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-admin-cron-secret");
    if (!process.env.ADMIN_CRON_SECRET || secret !== process.env.ADMIN_CRON_SECRET) {
      await logSystemEvent({
        function_name: "media_retention",
        status: "error",
        message: "Unauthorized retention invocation",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceSupabaseClient();
    const nowIso = new Date().toISOString();
    const { data: expired, error } = await supabase
      .from("video_renders")
      .select("id, storage_bucket, storage_object_key")
      .not("retention_until", "is", null)
      .lte("retention_until", nowIso)
      .limit(200);

    if (error) {
      throw new Error(error.message);
    }

    let removed = 0;
    for (const row of expired ?? []) {
      const bucket = row.storage_bucket as string | null;
      const key = row.storage_object_key as string | null;
      if (bucket && key) {
        const { error: rmErr } = await supabase.storage.from(bucket).remove([key]);
        if (rmErr) {
          await logSystemEvent({
            function_name: "media_retention",
            status: "error",
            message: rmErr.message,
            payload: { renderId: row.id },
          });
          continue;
        }
      }
      await supabase
        .from("video_renders")
        .update({
          status: "failed",
          final_video_path: null,
          cdn_url: null,
        })
        .eq("id", row.id as string);
      removed += 1;
    }

    await logSystemEvent({
      function_name: "media_retention",
      status: "success",
      message: `Processed ${removed} renders`,
    });

    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logSystemEvent({
      function_name: "media_retention",
      status: "error",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
