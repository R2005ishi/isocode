import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/types/contracts";

/**
 * Edge-safe Auth.js config (no Prisma, no bcrypt) — shared by `middleware.ts` and `auth.ts`.
 * Providers are added in `auth.ts`; the middleware only needs to decode the JWT.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // ASSUMPTION: one 8-hour staff shift.
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.showroomId = user.showroomId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.showroomId = (token.showroomId as string | null) ?? null;
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
