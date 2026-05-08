"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { emitLandingEvent } from "./useLandingEvent";

const capabilities = [
  {
    title: "Adaptive Demo Routing",
    body: "Route each prospect into the right journey automatically.",
  },
  {
    title: "Journey Graph Authoring",
    body: "Visual branching tracks with behavior-aware progression.",
  },
  {
    title: "Live Kuze AI Layer",
    body: "Consistent narration and objection handling in-session.",
  },
  {
    title: "Automated Video Pipeline",
    body: "Queue-based personalized recap generation and delivery.",
  },
];

export function LandingShowcase() {
  return (
    <section className="px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-[color:var(--panel-border)] bg-[radial-gradient(circle_at_30%_20%,rgba(44,247,223,0.2),rgba(0,13,46,0.85))] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
            Premium Suite
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            DEMOFORGE 2.0:
            <br />
            THE ERA OF AUTONOMOUS,
            <br />
            BEHAVIOR-AWARE DEMOS.
          </h1>
          <p className="mt-4 max-w-xl text-sm text-zinc-300">
            Meet Kuze AI. It watches, routes, and personalizes every journey to maximize
            engagement.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/demo"
              onClick={() => void emitLandingEvent("landing_cta_demo", { placement: "showcase_primary" })}
            >
              <Button>Start your personalized demo track</Button>
            </Link>
            <Link
              href="/admin/login"
              onClick={() => void emitLandingEvent("landing_cta_admin", { placement: "showcase_secondary" })}
            >
              <Button variant="secondary">Operator sign-in</Button>
            </Link>
          </div>
          <div className="mt-10 border-t border-white/10 pt-6">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Capabilities</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {capabilities.map((cap) => (
                <div key={cap.title} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-sm font-semibold">{cap.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">{cap.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-[color:var(--panel-border)] bg-[linear-gradient(180deg,rgba(9,22,64,0.95),rgba(2,8,30,0.95))] p-8">
          <h2 className="text-center text-xl font-semibold">Operator console</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-xs text-zinc-400">
            Live session counts, journey graphs, Kuze transcripts, and video jobs appear here for
            your team — not placeholder metrics.
          </p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Control plane preview</p>
              <div className="mt-3 h-32 rounded-lg bg-[linear-gradient(180deg,rgba(44,247,223,0.2),transparent)]" />
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold">Webhook Catalog</p>
              <p className="mt-1 text-xs text-zinc-400">
                Delivery log to action for customer catalogs.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold">Stripe Billing Foundation</p>
              <p className="mt-1 text-xs text-zinc-400">
                Summary checkout, customer, and portal.
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/billing"
              onClick={() => void emitLandingEvent("landing_cta_billing", { placement: "showcase_billing" })}
            >
              <Button variant="secondary">Integration & Billing</Button>
            </Link>
            <Link href="/demo">
              <Button variant="ghost">Launch demo flow</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

