import { cn } from "@/lib/utils";

/** Generic placeholder mark for "Brand X" — not a real manufacturer logo. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <path d="M9 9l14 14M23 9L9 23" strokeWidth="3.2" strokeLinecap="round" className="stroke-primary" />
    </svg>
  );
}
