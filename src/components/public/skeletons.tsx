import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeletons that mirror each page's real layout (no layout jump when data arrives). */

export function GridSkeleton({ count = 4, title = true }: { count?: number; title?: boolean }) {
  return (
    <div className="container-page pt-10 md:pt-16" aria-busy="true" aria-live="polite">
      {title && (
        <div className="mb-10 space-y-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <Skeleton className="aspect-[2/1] w-full rounded-xl" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="container-page pt-6 md:pt-10" aria-busy="true" aria-live="polite">
      <Skeleton className="mb-6 h-4 w-48" />
      <Skeleton className="mb-8 h-10 w-80 max-w-full" />
      <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <Skeleton className="aspect-[2/1] w-full rounded-2xl" />
          <div className="flex gap-2">
            <Skeleton className="h-14 w-24" />
            <Skeleton className="h-14 w-24" />
            <Skeleton className="h-14 w-24" />
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-12 w-full" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="container-page max-w-3xl pt-10 md:pt-16" aria-busy="true" aria-live="polite">
      <Skeleton className="mb-3 h-10 w-72 max-w-full" />
      <Skeleton className="mb-10 h-5 w-96 max-w-full" />
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-12 w-40" />
      </div>
    </div>
  );
}
