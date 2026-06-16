"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard", icon: "⬡" },
  { href: "/profiles", label: "Service Profiles", icon: "◈" },
  { href: "/templates", label: "Templates", icon: "◫" },
  { href: "/settings", label: "Settings", icon: "◎" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="px-5 py-5 border-b border-gray-200">
        <div className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-0.5">
          AI SEO Tool
        </div>
        <div className="text-sm font-medium text-gray-900">Content Pipeline</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-gray-200">
        <div className="text-xs text-gray-400">Pilot · Las Vegas</div>
      </div>
    </aside>
  );
}
