"use client";

export function BoardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="skeleton h-10 w-32 rounded-full" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-2xl p-4" />
        ))}
      </div>

      {/* Board columns skeleton */}
      <div className="grid gap-4 lg:grid-cols-4">
        {["Inbox", "Qualified", "Proposal", "Won/Lost"].map((col) => (
          <div key={col} className="space-y-3">
            <div className="skeleton h-6 w-24 rounded" />
            <div className="space-y-2 min-h-[300px]">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton h-20 rounded-xl p-3" />
              ))}
            </div>
            <div className="skeleton h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 p-6">
      <div className="skeleton h-8 w-48 rounded-lg" />
      <div className="skeleton h-4 w-64 rounded" />
      
      {/* Profile section */}
      <div className="space-y-4">
        <div className="skeleton h-6 w-32 rounded" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="skeleton h-12 w-full rounded-lg" />
          <div className="skeleton h-12 w-full rounded-lg" />
        </div>
      </div>

      {/* Preferences */}
      <div className="space-y-4">
        <div className="skeleton h-6 w-40 rounded" />
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="skeleton h-4 w-48 rounded" />
              <div className="skeleton h-3 w-64 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="skeleton h-4 w-48 rounded" />
              <div className="skeleton h-3 w-64 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Billing */}
      <div className="space-y-4">
        <div className="skeleton h-6 w-32 rounded" />
        <div className="skeleton h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function DealCardSkeleton() {
  return (
    <div className="skeleton h-28 w-full rounded-xl p-3" />
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="skeleton h-10 w-64 rounded-lg" />
      <div className="skeleton h-4 w-96 rounded" />
      <div className="grid gap-4 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-48 rounded-xl" />
        ))}
      </div>
    </div>
  );
}