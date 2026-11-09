"use client";

import { useActionState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CircleAlertIcon, Loader2Icon, LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "./actions";

const FormSchema = z.object({
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
type FormValues = z.infer<typeof FormSchema>;

// Seeded, obviously-fake demo accounts (see prisma/seed.ts). Not real people.
const DEMO_ACCOUNTS = [
  { email: "asha.consultant@brandx.test", role: "Consultant" },
  { email: "admin@brandx.test", role: "Admin" },
  { email: "ucm@brandx.test", role: "Used-car manager" },
] as const;
const DEMO_PASSWORD = "Demo@1234";

export function LoginForm({ next }: { next: string | null }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, { error: null });
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    const fd = new FormData();
    fd.set("email", values.email);
    fd.set("password", values.password);
    if (next) fd.set("next", next);
    startTransition(() => formAction(fd));
  });

  const fillDemo = (email: string) => {
    form.setValue("email", email, { shouldValidate: true });
    form.setValue("password", DEMO_PASSWORD, { shouldValidate: true });
    form.setFocus("password");
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} noValidate className="space-y-4" aria-describedby="login-error">
        {state.error && !pending && (
          <div
            id="login-error"
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          >
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.error}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="name@brandx.test"
            className="h-10"
            aria-invalid={!!errors.email}
            {...form.register("email")}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            className="h-10"
            aria-invalid={!!errors.password}
            {...form.register("password")}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <LogInIcon />}
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="rounded-xl border border-dashed bg-muted/40 p-4">
        <p className="text-sm font-medium">Demo logins</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Sample accounts with fake data. Password for all:{" "}
          <code className="rounded bg-background px-1 py-0.5 font-mono text-foreground">{DEMO_PASSWORD}</code>
        </p>
        <ul className="mt-3 grid gap-1.5">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                onClick={() => fillDemo(a.email)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="truncate font-mono text-xs">{a.email}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{a.role} · Use</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
