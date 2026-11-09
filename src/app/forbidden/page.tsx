import type { Metadata } from "next";
import Link from "next/link";
import { ShieldXIcon } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/components/staff/labels";
import { homeForRole } from "../login/safe-next";
import { logoutAction } from "../login/actions";

export const metadata: Metadata = {
  title: "Access denied · Brand X Lucknow",
  robots: { index: false, follow: false },
};

export default async function ForbiddenPage() {
  const session = await auth();
  const role = session?.user?.role;
  const home = role ? homeForRole(role) : "/";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldXIcon className="size-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">You don’t have access to this page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {role
            ? `You are signed in as ${session.user.name} (${ROLE_LABEL[role]}). This area is for a different role.`
            : "Sign in with a staff account to continue."}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild className="h-9">
            <Link href={home}>{role && role !== "BUYER" ? "Go to my workspace" : "Go to home page"}</Link>
          </Button>
          {role ? (
            <form action={logoutAction}>
              <Button type="submit" variant="outline" className="h-9 w-full">
                Sign in as someone else
              </Button>
            </form>
          ) : (
            <Button asChild variant="outline" className="h-9">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
