import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { absoluteUrl } from "@/lib/site";
import { JsonLd } from "./json-ld";

export function Breadcrumbs({ items }: { items: { href: string; label: string }[] }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          {items.map((it, i) => {
            const last = i === items.length - 1;
            return (
              <li key={it.href} className="flex items-center gap-1">
                {last ? (
                  <span aria-current="page" className="text-foreground">
                    {it.label}
                  </span>
                ) : (
                  <>
                    <Link href={it.href} className="hover:text-primary">
                      {it.label}
                    </Link>
                    <ChevronRightIcon className="size-3.5" aria-hidden="true" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((it, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: it.label,
            item: absoluteUrl(it.href),
          })),
        }}
      />
    </>
  );
}
