import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

/**
 * Canonical share/viewer path for a demo run (`runId` === `demo_sessions.id`).
 * Requires `token` (session token) — same contract as `/demo/[sessionId]`.
 */
export default async function DemoRunViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { runId } = await params;
  const { token } = await searchParams;
  if (token && typeof token === "string" && token.trim()) {
    redirect(`/demo/${runId}?token=${encodeURIComponent(token.trim())}`);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card className="p-6 text-center">
        <h1 className="text-lg font-semibold">Demo link incomplete</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Open the full demo link from your email — it includes a private access token so only
          you can open this run.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/demo" className="text-[color:var(--accent)] underline">
            Request a new demo
          </Link>
        </p>
      </Card>
    </div>
  );
}
