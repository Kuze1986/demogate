import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import Link from "next/link";

const NAV = [
  { href: "/dashboard",           label: "Overview"   },
  { href: "/dashboard/videos",    label: "Videos"     },
  { href: "/dashboard/prospects", label: "Prospects"  },
  { href: "/dashboard/scripts",   label: "Scripts"    },
  { href: "/dashboard/settings",  label: "Settings"   },
  { href: "/dashboard/billing",   label: "Billing"    },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const ctx = await getCurrentTenant(user.id);
  if (!ctx) redirect("/onboarding");

  const { tenant } = ctx;

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-800 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Workspace</p>
          <p className="text-sm font-semibold text-white truncate">{tenant.name}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-gray-800">
          <p className="text-xs text-gray-600 truncate">{user.email}</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
