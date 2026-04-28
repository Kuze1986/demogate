import { IntakeForm } from "@/components/intake/IntakeForm";

export default async function DemoIntakePage({
  searchParams,
}: {
  searchParams: Promise<{
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
  }>;
}) {
  const { utm_source, utm_medium, utm_campaign, utm_term, utm_content } =
    await searchParams;
  const initialUtm = {
    ...(utm_source ? { utm_source } : {}),
    ...(utm_medium ? { utm_medium } : {}),
    ...(utm_campaign ? { utm_campaign } : {}),
    ...(utm_term ? { utm_term } : {}),
    ...(utm_content ? { utm_content } : {}),
  };

  return (
    <div className="flex min-h-full flex-col items-center px-4 py-12">
      <div className="mb-6 text-center">
        <p className="text-xs uppercase tracking-[0.24em] soft-muted">Kuze Guided Demo</p>
        <h1 className="text-3xl font-semibold">Build your personalized walkthrough</h1>
      </div>
      <IntakeForm initialUtm={initialUtm} />
    </div>
  );
}
