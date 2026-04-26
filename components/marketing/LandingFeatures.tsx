import { Card } from "@/components/ui/Card";

const features = [
  {
    title: "Intelligent routing",
    body: "Persona-aware intake maps prospects to the right product track with explainable decisions.",
  },
  {
    title: "Kuze everywhere",
    body: "One voice across live chat, follow-up, and generated scripts — no fragmented AI personas.",
  },
  {
    title: "Video pipeline",
    body: "Queue-backed renders with variants, hotspots, and ops visibility for delivery teams.",
  },
  {
    title: "Behavioral loop",
    body: "Simulation plus playback signals feed scoring and variant performance over time.",
  },
  {
    title: "Enterprise rails",
    body: "Tenancy, RBAC, audit trails, CRM sync, and webhooks for serious GTM infrastructure.",
  },
  {
    title: "Hardened media",
    body: "Object storage, signed URLs, CDN-friendly delivery, and retention policies for assets at scale.",
  },
] as const;

export function LandingFeatures() {
  return (
    <section id="features" className="border-t border-[color:var(--panel-border)] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[color:var(--muted)]">Platform</p>
        <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Built for autonomous execution</h2>
        <p className="mt-4 max-w-2xl text-[color:var(--muted)]">
          DemoForge is not a static tour builder — it is the control plane for how demos run, score, and ship.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="h-full transition hover:border-[color:var(--accent)]/40">
              <h3 className="text-lg font-semibold text-[color:var(--accent)]">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">{f.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
