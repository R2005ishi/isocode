import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { destinationFor } from "../safe-next";

export const dynamic = "force-dynamic";

/** Post-sign-in router: sends each role to its home (or a permitted `?next=`). */
export default async function ContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  const { next } = await searchParams;
  if (!session?.user) redirect("/login");
  redirect(destinationFor(session.user.role, next));
}
