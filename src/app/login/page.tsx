import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, GaugeIcon } from "lucide-react";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";
import { destinationFor, safeNext } from "./safe-next";

export const metadata: Metadata = {
  title: "Staff sign-in · Brand X Lucknow",
  description: "Sign in to the Brand X dealer lead inbox and admin.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await auth();
  // Already signed in → straight to the right place.
  if (session?.user) redirect(destinationFor(session.user.role, next));

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="text-sm font-semibold tracking-tight opacity-90 hover:opacity-100">
          Brand X · Lucknow
        </Link>
        <div className="max-w-md space-y-4">
          <GaugeIcon className="size-10 opacity-80" aria-hidden />
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Every lead called within five minutes.
          </h2>
          <p className="text-sm leading-relaxed opacity-75">
            The lead inbox shows a live timer on every new enquiry, an AI summary of what the buyer
            wants, and a reply draft you review before it goes out.
          </p>
        </div>
        <p className="text-xs opacity-60">Authorised dealer staff only.</p>
      </aside>

      <section className="flex flex-col px-4 py-8 sm:px-8">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" aria-hidden /> Back to showroom site
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">Staff sign-in</h1>
          <p className="mt-1 mb-8 text-sm text-muted-foreground">
            Consultants, managers and admins of Brand X Lucknow.
          </p>
          <LoginForm next={safeNext(next)} />
        </div>
      </section>
    </main>
  );
}
