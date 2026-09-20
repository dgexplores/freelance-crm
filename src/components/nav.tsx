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
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/40 bg-white/70 py-1.5 pl-5 pr-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl view-transition-nav" style={{ viewTransitionName: "main-nav" }}>
        <Link href="/board" className="font-display text-base font-bold tracking-tight text-zinc-950" data-view-transition>
          Inbox&nbsp;CRM
        </Link>
        <span className="mx-2 h-4 w-px bg-zinc-300" aria-hidden="true" />
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/board" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              data-view-transition
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300 ${
                active
                  ? "bg-zinc-950 text-white shadow"
                  : "text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-950"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
