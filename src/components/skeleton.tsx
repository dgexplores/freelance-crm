"use client";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`${className} animate-pulse bg-zinc-200 rounded`}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-1/2 mb-2" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-2/3 mb-2" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

export function BoardSkeleton() {
  const STAGES = ["INBOX", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <Skeleton className="h-3 w-1/2 mb-6" />
      </div>
      <main className="mx-auto max-w-7xl px-6 pb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {STAGES.map((stage) => (
            <section key={stage} className="flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              <Skeleton className="h-3 w-3/4 mb-2" />
              <div className="flex flex-1 flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-100/60 p-2">
                {[1, 2, 3].map((i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

export function DealDetailSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <div className="mx-auto max-w-7xl px-6 pb-3 border-b border-zinc-200">
          <nav className="flex gap-1 overflow-x-auto">
            {["Overview", "Emails", "Facts", "Tasks"].map((tab) => (
              <Skeleton key={tab} className="h-8 w-20 rounded-t-lg" />
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-zinc-200 bg-white p-6">
                <Skeleton className="h-4 w-32 mb-4" />
                <div className="space-y-3">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-6">
            <div className="rounded-lg border border-zinc-200 bg-white p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="space-y-8">
        <section>
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-4 w-3/4 mb-4" />
          <Skeleton className="h-[400px] w-full rounded-lg" />
          <div className="mt-3 flex gap-3">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-40" />
          </div>
        </section>
        <section>
          <Skeleton className="h-4 w-32 mb-3" />
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </section>
        <section>
          <Skeleton className="h-4 w-32 mb-3" />
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}