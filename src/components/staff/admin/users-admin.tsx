"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  KeyRoundIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  UserRoundCheckIcon,
  UserRoundXIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AdminUserSchema, RoleEnum, type Role } from "@/types/contracts";
import { ROLE_LABEL } from "../labels";
import { EmptyState, ErrorState, PageHeader } from "../states";
import {
  ActiveDot,
  adminApi,
  ConfirmDialog,
  Field,
  useAdminList,
  useAdminMutation,
  useLookups,
} from "./shared";
import type { AdminUser } from "./types";

const NO_SHOWROOM = "__none";

export function UsersAdmin({ meId }: { meId: string }) {
  const users = useAdminList<AdminUser>("users");
  const lookups = useLookups();
  const [editing, setEditing] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  });
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [toggleFor, setToggleFor] = useState<AdminUser | null>(null);
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");

  const toggle = useAdminMutation(
    "users",
    (u: AdminUser) => adminApi.update<AdminUser>("users", u.id, { isActive: !u.isActive }),
    {
      success: (r) =>
        `${(r as AdminUser).name} ${(r as AdminUser).isActive ? "can sign in again" : "deactivated"}`,
      onSuccess: () => setToggleFor(null),
    },
  );

  const list = (users.data ?? []).filter((u) => roleFilter === "ALL" || u.role === roleFilter);
  const showrooms = lookups.data?.showrooms ?? [];
  const models = lookups.data?.models ?? [];
  const modelName = (id: string) => models.find((m) => m.id === id)?.name;
  const specialtyText = (u: AdminUser) =>
    (u.specialtyModelIds ?? []).map(modelName).filter(Boolean).join(", ");

  return (
    <div>
      <PageHeader
        title="Users & roles"
        description="Staff and buyer accounts. Users are deactivated, never deleted, so lead history is kept."
        actions={
          <Button onClick={() => setEditing({ open: true, user: null })}>
            <PlusIcon /> Add user
          </Button>
        }
      />
      <div className="mb-4">
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
          <SelectTrigger size="sm" className="bg-background min-w-44" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            {RoleEnum.options.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {users.isPending ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => users.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users with this role" />
      ) : (
        <>
          <div className="bg-background hidden overflow-hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Showroom</TableHead>
                  <TableHead>Specialties</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((u) => (
                  <TableRow key={u.id} className={cn(!u.isActive && "text-muted-foreground")}>
                    <TableCell className="py-2.5 pl-4">
                      <p className="font-medium">
                        {u.name}
                        {u.id === meId && (
                          <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">{u.email}</p>
                    </TableCell>
                    <TableCell>{ROLE_LABEL[u.role]}</TableCell>
                    <TableCell>
                      {u.showroom?.name ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="max-w-48 text-sm">
                      {u.role === "CONSULTANT" ? (
                        specialtyText(u) || (
                          <span className="text-muted-foreground">All models</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ActiveDot active={u.isActive} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <UserActions
                        u={u}
                        meId={meId}
                        onEdit={() => setEditing({ open: true, user: u })}
                        onReset={() => setResetFor(u)}
                        onToggle={() => setToggleFor(u)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="grid gap-2 md:hidden">
            {list.map((u) => (
              <li key={u.id} className="bg-background rounded-xl border p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {u.name}
                      {u.id === meId && (
                        <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">{u.email}</p>
                  </div>
                  <ActiveDot active={u.isActive} />
                </div>
                <p className="mt-1.5 text-sm">
                  {ROLE_LABEL[u.role]}
                  {u.showroom && (
                    <span className="text-muted-foreground"> · {u.showroom.name}</span>
                  )}
                </p>
                {u.role === "CONSULTANT" && specialtyText(u) && (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Specialises in {specialtyText(u)}
                  </p>
                )}
                <div className="mt-2 flex justify-end border-t pt-2">
                  <UserActions
                    u={u}
                    meId={meId}
                    onEdit={() => setEditing({ open: true, user: u })}
                    onReset={() => setResetFor(u)}
                    onToggle={() => setToggleFor(u)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing.open && (
        <UserDialog
          user={editing.user}
          meId={meId}
          showrooms={showrooms}
          models={models}
          onClose={() => setEditing({ open: false, user: null })}
        />
      )}
      {resetFor && <ResetPasswordDialog user={resetFor} onClose={() => setResetFor(null)} />}
      <ConfirmDialog
        open={!!toggleFor}
        onOpenChange={(o) => !o && setToggleFor(null)}
        title={
          toggleFor?.isActive ? `Deactivate ${toggleFor?.name}?` : `Reactivate ${toggleFor?.name}?`
        }
        description={
          toggleFor?.isActive
            ? "They will no longer be able to sign in. Their leads and history stay as they are — re-assign open leads from the inbox."
            : "They will be able to sign in again with their existing password."
        }
        confirmLabel={toggleFor?.isActive ? "Deactivate" : "Reactivate"}
        destructive={!!toggleFor?.isActive}
        pending={toggle.isPending}
        onConfirm={() => toggleFor && toggle.mutate(toggleFor)}
      />
    </div>
  );
}

function UserActions({
  u,
  meId,
  onEdit,
  onReset,
  onToggle,
}: {
  u: AdminUser;
  meId: string;
  onEdit: () => void;
  onReset: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="inline-flex gap-1">
      <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${u.name}`}>
        <PencilIcon /> <span className="hidden lg:inline">Edit</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onReset}
        aria-label={`Reset password for ${u.name}`}
      >
        <KeyRoundIcon /> <span className="hidden lg:inline">Password</span>
      </Button>
      {u.id !== meId && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onToggle}
          className={cn(u.isActive && "text-destructive hover:text-destructive")}
          aria-label={u.isActive ? `Deactivate ${u.name}` : `Reactivate ${u.name}`}
        >
          {u.isActive ? <UserRoundXIcon /> : <UserRoundCheckIcon />}
          <span className="hidden lg:inline">{u.isActive ? "Deactivate" : "Reactivate"}</span>
        </Button>
      )}
    </div>
  );
}

const UserFormSchema = AdminUserSchema.extend({
  showroomId: z.string(),
  phone: z.string().trim().max(15),
  password: z.string(),
  specialtyModelIds: z.array(z.string()),
});
type UserForm = z.input<typeof UserFormSchema>;

function UserDialog({
  user,
  meId,
  showrooms,
  models,
  onClose,
}: {
  user: AdminUser | null;
  meId: string;
  showrooms: { id: string; name: string }[];
  models: { id: string; name: string }[];
  onClose: () => void;
}) {
  const isSelf = user?.id === meId;
  const form = useForm<UserForm>({
    resolver: zodResolver(
      UserFormSchema.superRefine((v, ctx) => {
        // Password is required on create only; reset it separately for existing users.
        if (!user && v.password.length < 8)
          ctx.addIssue({ code: "custom", path: ["password"], message: "At least 8 characters" });
      }),
    ),
    defaultValues: user
      ? {
          name: user.name,
          email: user.email,
          role: user.role,
          showroomId: user.showroomId ?? NO_SHOWROOM,
          phone: user.phone ?? "",
          password: "",
          isActive: user.isActive,
          specialtyModelIds: user.specialtyModelIds ?? [],
        }
      : {
          name: "",
          email: "",
          role: "CONSULTANT",
          showroomId: NO_SHOWROOM,
          phone: "",
          password: "",
          isActive: true,
          specialtyModelIds: [],
        },
  });
  const save = useAdminMutation(
    "users",
    (v: UserForm) => {
      const body = {
        name: v.name,
        email: v.email,
        role: v.role,
        showroomId: v.showroomId === NO_SHOWROOM ? null : v.showroomId,
        phone: v.phone?.trim() ? v.phone : undefined,
        isActive: v.isActive,
        specialtyModelIds: v.role === "CONSULTANT" ? v.specialtyModelIds : [],
        ...(user ? {} : { password: v.password }),
      };
      return user
        ? adminApi.update<AdminUser>("users", user.id, body)
        : adminApi.create<AdminUser>("users", body);
    },
    { success: (r) => `${(r as AdminUser).name} saved`, onSuccess: onClose, form },
  );
  const role = form.watch("role");
  const specialties = form.watch("specialtyModelIds") ?? [];
  const toggleSpecialty = (id: string, on: boolean) =>
    form.setValue(
      "specialtyModelIds",
      on ? [...specialties, id] : specialties.filter((x) => x !== id),
      { shouldDirty: true },
    );

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? `Edit ${user.name}` : "Add user"}</DialogTitle>
          <DialogDescription>
            Consultants get new leads from their showroom (and specialty models) automatically.
          </DialogDescription>
        </DialogHeader>
        <form
          id="user-form"
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
          className="grid gap-4 sm:grid-cols-2"
          noValidate
        >
          <Field form={form} name="name" label="Full name">
            <Input id="name" autoComplete="off" {...form.register("name")} />
          </Field>
          <Field form={form} name="email" label="Email">
            <Input id="email" type="email" autoComplete="off" {...form.register("email")} />
          </Field>
          <Field
            form={form}
            name="role"
            label="Role"
            hint={isSelf ? "You can’t change your own role." : undefined}
          >
            <Select
              value={role}
              onValueChange={(v) => form.setValue("role", v as Role)}
              disabled={isSelf}
            >
              <SelectTrigger id="role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RoleEnum.options.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            form={form}
            name="showroomId"
            label="Showroom"
            hint={role === "CONSULTANT" ? "Leads for this showroom are routed to them." : undefined}
          >
            <Select
              value={form.watch("showroomId")}
              onValueChange={(v) => form.setValue("showroomId", v)}
            >
              <SelectTrigger id="showroomId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SHOWROOM}>No showroom</SelectItem>
                {showrooms.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field form={form} name="phone" label="Phone (optional)">
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              {...form.register("phone")}
            />
          </Field>
          {role === "CONSULTANT" && models.length > 0 && (
            <fieldset className="space-y-2 sm:col-span-2">
              <legend className="text-sm font-medium">Model specialties</legend>
              <p className="text-muted-foreground text-xs">
                Leads for these models go to them first. Leave all unticked for a generalist.
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
                {models.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`spec-${m.id}`}
                      checked={specialties.includes(m.id)}
                      onCheckedChange={(c) => toggleSpecialty(m.id, c === true)}
                    />
                    <Label htmlFor={`spec-${m.id}`} className="font-normal">
                      {m.name}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>
          )}
          {!user && (
            <Field
              form={form}
              name="password"
              label="Initial password"
              hint="At least 8 characters. Share it securely."
            >
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...form.register("password")}
              />
            </Field>
          )}
          {!isSelf && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id="isActive"
                checked={form.watch("isActive")}
                onCheckedChange={(c) =>
                  form.setValue("isActive", c === true, { shouldDirty: true })
                }
              />
              <Label htmlFor="isActive" className="font-normal">
                Active — can sign in
              </Label>
            </div>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" disabled={save.isPending}>
            {save.isPending && <Loader2Icon className="animate-spin" />}
            {user ? "Save changes" : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ResetSchema = z
  .object({ password: z.string().min(8, "At least 8 characters").max(100), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don’t match" });

function ResetPasswordDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const form = useForm<z.infer<typeof ResetSchema>>({
    resolver: zodResolver(ResetSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const save = useAdminMutation(
    "users",
    (v: { password: string }) =>
      adminApi.update<AdminUser>("users", user.id, { password: v.password }),
    { success: `Password reset for ${user.name}`, onSuccess: onClose, form },
  );
  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {user.name}. Share it with them securely; they keep their role
            and leads.
          </DialogDescription>
        </DialogHeader>
        <form
          id="reset-form"
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
          className="space-y-4"
          noValidate
        >
          <Field form={form} name="password" label="New password">
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...form.register("password")}
            />
          </Field>
          <Field form={form} name="confirm" label="Confirm password">
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              {...form.register("confirm")}
            />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="reset-form" disabled={save.isPending}>
            {save.isPending && <Loader2Icon className="animate-spin" />}
            Reset password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
