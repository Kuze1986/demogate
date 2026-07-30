import { LandingFooter } from "@/components/marketing/LandingFooter";
import { LandingShowcase } from "@/components/marketing/LandingShowcase";
import { getMarketingPack } from "@/lib/vantage/client";

function capabilitiesFromPack(
  pack: Awaited<ReturnType<typeof getMarketingPack>>,
): { title: string; body: string }[] | undefined {
  if (!pack?.brand) return undefined;
  const fromCaptions = (pack.brand.captions ?? [])
    .filter((c) => c.title && c.body)
    .slice(0, 4)
    .map((c) => ({ title: c.title, body: c.body.slice(0, 140) }));
  if (fromCaptions.length >= 2) return fromCaptions;
  if (pack.brand.insight?.sqHeadline && pack.brand.insight?.sqBody) {
    return [
      { title: String(pack.brand.insight.sqHeadline), body: String(pack.brand.insight.sqBody).slice(0, 140) },
      ...(fromCaptions.length ? fromCaptions : []),
    ].slice(0, 4);
  }
  return fromCaptions.length ? fromCaptions : undefined;
}

export default async function Home() {
  const pack = await getMarketingPack("demoforge");
  const launch = pack?.brand?.launch;

  return (
    <div className="flex min-h-full flex-col">
      <LandingShowcase
        eyebrow={typeof launch?.eyebrow === "string" ? launch.eyebrow : undefined}
        headline={typeof launch?.sqHeadline === "string" ? launch.sqHeadline : undefined}
        subhead={
          typeof launch?.sqSub === "string"
            ? launch.sqSub
            : typeof pack?.brand?.essence === "string"
              ? pack.brand.essence
              : undefined
        }
        primaryCta={typeof launch?.cta === "string" ? launch.cta : undefined}
        capabilities={capabilitiesFromPack(pack)}
      />
      <LandingFooter />
    </div>
  );
}
