import { IntakeForm } from "@/components/intake/IntakeForm";

export default function DemoIntakePage() {
  return (
    <div className="flex min-h-full flex-col items-center px-4 py-12">
      <div className="mb-6 text-center">
        <p className="text-xs uppercase tracking-[0.24em] soft-muted">Kuze Guided Demo</p>
        <h1 className="text-3xl font-semibold">Build your personalized walkthrough</h1>
      </div>
      <IntakeForm />
    </div>
  );
}
