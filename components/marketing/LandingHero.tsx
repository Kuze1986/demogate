"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { emitLandingEvent } from "./useLandingEvent";

export function LandingHero() {
  useEffect(() => {
    void emitLandingEvent("landing_view", { section: "hero" });
  }, []);

  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pb-28 lg:pt-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(44,247,223,0.25),transparent)]" />
      <div className="relative mx-auto max-w-5xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--accent)]">
          DemoForge 2.0
        </p>
        <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          Autonomous demo delivery for{" "}
          <span className="bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] bg-clip-text text-transparent">
            NEXUS Holdings
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-[color:var(--muted)] sm:text-lg">
          Route every prospect to the right track, run adaptive demos with Kuze, generate personalized video
          assets, and close the loop with behavioral intelligence — all from one system-of-action.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link href="/demo" onClick={() => void emitLandingEvent("landing_cta_demo", { placement: "hero_primary" })}>
            <Button className="min-w-[200px] px-8 py-3 text-base">Start a demo</Button>
          </Link>
          <Link href="/billing" onClick={() => void emitLandingEvent("landing_cta_billing", { placement: "hero_secondary" })}>
            <Button variant="secondary" className="min-w-[200px] px-8 py-3 text-base">
              Plans & billing
            </Button>
          </Link>
          <Link href="/admin/login" onClick={() => void emitLandingEvent("landing_cta_admin", { placement: "hero_tertiary" })}>
            <Button variant="ghost" className="min-w-[160px] text-base">
              Admin
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
