"use client";

import { ErrorState } from "@/components/public/error-state";

/** Fallback for errors outside a more specific segment boundary. */
export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="min-h-dvh">
      <ErrorState {...props} />
    </main>
  );
}
