import { LandingFaq } from "@/components/marketing/LandingFaq";
import { LandingFeatures } from "@/components/marketing/LandingFeatures";
import { LandingFooter } from "@/components/marketing/LandingFooter";
import { LandingHero } from "@/components/marketing/LandingHero";
import { LandingPricingTeaser } from "@/components/marketing/LandingPricingTeaser";
import { LandingTestimonials } from "@/components/marketing/LandingTestimonials";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <LandingHero />
      <LandingFeatures />
      <LandingTestimonials />
      <LandingPricingTeaser />
      <LandingFaq />
      <LandingFooter />
    </div>
  );
}
