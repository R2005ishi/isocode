import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Page-level gate for staff areas. Every API handler re-checks roles itself (defence in depth);
 * API routes are not matched here so they can return JSON 401/403 instead of redirects.
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const user = req.auth?.user;

  if (!user) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  const role = user.role;
  let allowed = false;
  if (pathname === "/inbox" || pathname.startsWith("/inbox/")) {
    allowed = role === "CONSULTANT" || role === "ADMIN";
  } else if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const usedCars = pathname === "/admin/used-cars" || pathname.startsWith("/admin/used-cars/");
    allowed = role === "ADMIN" || (usedCars && role === "USED_CAR_MANAGER");
  }
  if (!allowed) return NextResponse.redirect(new URL("/forbidden", req.nextUrl.origin));
  return NextResponse.next();
});

export const config = {
  matcher: ["/inbox", "/inbox/:path*", "/admin", "/admin/:path*"],
};
