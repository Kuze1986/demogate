import { Card } from "@/components/ui/Card";

const quotes = [
  {
    quote: "We finally have one pipeline from intake to follow-up — not three disconnected tools.",
    author: "Ops Lead",
    org: "Enterprise GTM",
  },
  {
    quote: "The behavioral layer makes our demo variants measurable instead of guesswork.",
    author: "RevOps",
    org: "SaaS scale-up",
  },
] as const;

export function LandingTestimonials() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[color:var(--muted)]">Proof</p>
        <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Teams shipping with confidence</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {quotes.map((q) => (
            <Card key={q.author} className="metric-gradient">
              <p className="text-lg font-medium leading-relaxed">&ldquo;{q.quote}&rdquo;</p>
              <p className="mt-4 text-sm text-[color:var(--muted)]">
                — {q.author}, <span className="text-[color:var(--accent-2)]">{q.org}</span>
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
