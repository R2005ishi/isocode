"use client";

import { ErrorState } from "@/components/public/error-state";

export default function SegmentError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState {...props} />;
}
