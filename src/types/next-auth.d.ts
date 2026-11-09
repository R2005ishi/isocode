import type { DefaultSession } from "next-auth";
import type { Role } from "@/types/contracts";

declare module "next-auth" {
  interface User {
    role: Role;
    showroomId: string | null;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      showroomId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    showroomId?: string | null;
  }
}
