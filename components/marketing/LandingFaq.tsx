"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { emitLandingEvent } from "./useLandingEvent";

const faqs = [
  {
    q: "Is DemoForge a demo builder or a delivery engine?",
    a: "Both — authoring and templates exist, but the core value is autonomous execution: routing, playback, video, and follow-up as one system.",
  },
  {
    q: "How does behavioral intelligence work?",
    a: "Simulation profiles tune capture behavior; playback events and scoring close the loop so variants improve over time.",
  },
  {
    q: "Can we run this in a regulated environment?",
    a: "Hybrid tenancy, RBAC, audit trails, and SSO hooks are designed for enterprise governance from day one.",
  },
] as const;

export function LandingFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[color:var(--muted)]">FAQ</p>
        <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Questions, answered</h2>
        <div className="mt-8 space-y-3">
          {faqs.map((item, i) => (
            <Card key={item.q} className="overflow-hidden p-0">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-medium sm:text-base"
                onClick={() => {
                  const next = open === i ? null : i;
                  setOpen(next);
                  if (next === i) void emitLandingEvent("landing_faq_expand", { index: i });
                }}
                aria-expanded={open === i}
              >
                {item.q}
                <span className="shrink-0 text-[color:var(--accent)]">{open === i ? "−" : "+"}</span>
              </button>
              {open === i ? (
                <div className="border-t border-[color:var(--panel-border)] px-4 py-3 text-sm text-[color:var(--muted)]">
                  {item.a}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
