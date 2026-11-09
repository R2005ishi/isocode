import { NotFoundState } from "@/components/public/not-found-state";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";

/** Unmatched URLs anywhere in the app. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        <NotFoundState />
      </main>
      <SiteFooter />
    </div>
  );
}
