import { getUser } from "@/lib/session";
import { Nav } from "@/components/nav";
import { PrefetchLink } from "@/components/prefetch-link";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top nav - shown on mobile */}
      <Nav />
      <KeyboardShortcutsHelp />
      
      <div className="hidden lg:flex min-h-screen">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 w-64 transform bg-white border-r border-zinc-200 transition-transform duration-300 ease-out lg:translate-x-0" style={{ viewTransitionName: "sidebar" }}>
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center justify-center border-b border-zinc-200">
              <PrefetchLink href="/board" data-view-transition className="font-display text-xl font-bold tracking-tight text-zinc-900">
                Inbox&nbsp;CRM
              </PrefetchLink>
            </div>
            
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              <PrefetchLink
                href="/board"
                data-view-transition
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              >
                Pipeline
              </PrefetchLink>
              <PrefetchLink
                href="/settings"
                data-view-transition
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-900 bg-zinc-100"
              >
                Settings
              </PrefetchLink>
            </nav>
            
            <div className="border-t border-zinc-200 p-4">
              {user && (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white text-sm font-semibold">
                    {user.name?.[0]?.toUpperCase() ?? user.email[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{user.name ?? "User"}</p>
                    <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
        
        {/* Main content */}
        <main className="flex-1 lg:ml-64 lg:pl-8 pt-20 pb-8" style={{ viewTransitionName: "main-content" }}>
          {children}
        </main>
      </div>
    </div>
  );
}