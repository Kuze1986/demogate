import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-[color:var(--panel-border)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-sm text-[color:var(--muted)] sm:flex-row">
        <p>© {new Date().getFullYear()} NEXUS Holdings · DemoForge</p>
        <nav className="flex flex-wrap justify-center gap-6">
          <Link href="/demo" className="hover:text-[color:var(--accent)]">
            Demo
          </Link>
          <Link href="/billing" className="hover:text-[color:var(--accent)]">
            Billing
          </Link>
          <Link href="/admin/login" className="hover:text-[color:var(--accent)]">
            Admin
          </Link>
        </nav>
      </div>
    </footer>
  );
}
