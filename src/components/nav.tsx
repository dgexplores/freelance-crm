"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/board", label: "Pipeline" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-12 items-center justify-between">
          <Link href="/board" className="text-lg font-semibold text-zinc-900">
            Inbox CRM
          </Link>
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === item.href || (item.href !== "/board" && pathname.startsWith(item.href))
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}