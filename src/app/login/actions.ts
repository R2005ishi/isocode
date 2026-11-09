"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { EmailSchema } from "@/types/contracts";
import { safeNext } from "./safe-next";

const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "Enter your password").max(100),
  next: z.string().optional(),
});

export type LoginState = { error: string | null };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const next = safeNext(parsed.data.next);
  // The role is only known after sign-in, so /login/continue reads the fresh session and routes by role.
  const redirectTo = `/login/continue${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo,
    });
  } catch (err) {
    // signIn throws NEXT_REDIRECT on success — it must propagate.
    if (err instanceof AuthError) {
      return {
        error:
          err.type === "CredentialsSignin"
            ? "Email or password is incorrect."
            : "Could not sign you in right now. Please try again.",
      };
    }
    throw err;
  }
  return { error: null };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
