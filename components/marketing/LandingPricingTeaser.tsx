"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { emitLandingEvent } from "./useLandingEvent";

export function LandingPricingTeaser() {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="border-t border-[color:var(--panel-border)] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[color:var(--muted)]">Pricing</p>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Simple tiers, serious power</h2>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-4 py-2">
            <span className={`text-sm ${!annual ? "text-[color:var(--foreground)]" : "text-[color:var(--muted)]"}`}>
              Monthly
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={annual}
              onClick={() => {
                setAnnual((v) => !v);
                void emitLandingEvent("landing_pricing_toggle", { annual: !annual });
              }}
              className="relative h-7 w-12 rounded-full bg-[rgba(44,247,223,0.25)] transition"
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-[color:var(--accent)] shadow transition ${
                  annual ? "left-5" : "left-0.5"
                }`}
              />
            </button>
            <span className={`text-sm ${annual ? "text-[color:var(--foreground)]" : "text-[color:var(--muted)]"}`}>
              Annual
            </span>
          </div>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {[
            { name: "Launch", price: annual ? "Contact" : "Contact", blurb: "Core routing + demos + follow-up." },
            { name: "Scale", price: annual ? "Contact" : "Contact", blurb: "Video pipeline + integrations + governance." },
            { name: "Command", price: annual ? "Contact" : "Contact", blurb: "Full control plane + dedicated support." },
          ].map((tier) => (
            <Card key={tier.name} className="flex flex-col">
              <h3 className="text-xl font-semibold">{tier.name}</h3>
              <p className="mt-2 text-3xl font-bold tabular-nums text-[color:var(--accent)]">{tier.price}</p>
              <p className="mt-3 flex-1 text-sm text-[color:var(--muted)]">{tier.blurb}</p>
              <Link href="/billing" className="mt-6" onClick={() => void emitLandingEvent("landing_cta_billing", { tier: tier.name })}>
                <Button variant="secondary" className="w-full">
                  View billing
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
