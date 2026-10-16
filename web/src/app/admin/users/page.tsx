"use client";

import { KeyRound, Pencil, Plus, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RequireRole } from "@/components/layout/require-role";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, Skeleton } from "@/components/ui/panel";
import { PasswordInput } from "@/components/ui/password-input";
import {
  type PermissionInfo,
  type StaffMember,
  useCreateStaff,
  usePermissionCatalogue,
  useResetStaffPassword,
  useStaff,
  useUpdateStaff
} from "@/features/admin/staff-api";
import type { Permission } from "@/features/auth/use-session";
import { ApiError } from "@/lib/api/client";
import { useL } from "@/lib/i18n";
import { cn, formatDateTime } from "@/lib/utils";

const ROLE_LABEL: Record<string, [string, string]> = {
  ADMIN: ["Administrator", "Administrator"],
  STAFF: ["İşçi", "Staff"],
  SPECIALIST: ["Mütəxəssis", "Specialist"],
  SUPERVISOR: ["Rəhbər", "Supervisor"]
};

// Common jobs, so the administrator does not tick every box by hand. Still editable.
const PRESETS: { label: [string, string]; position: string; permissions: Permission[] }[] = [
  {
    label: ["Sənəd yoxlayan", "Document checker"],
    position: "Sənəd yoxlayan mütəxəssis",
    permissions: ["APPLICATIONS_VIEW", "APPLICATIONS_DECIDE", "IDENTIFIER_REVEAL"]
  },
  {
    label: ["Torpaq və müsabiqə", "Land and competitions"],
    position: "Torpaq fondu mütəxəssisi",
    permissions: ["AREAS_MANAGE", "COMPETITIONS_MANAGE", "LISTINGS_MANAGE", "SUITABILITY_MANAGE"]
  },
  {
    label: ["Nazirlik rəhbərliyi", "Ministry management"],
    position: "Nazirlik nümayəndəsi",
    permissions: ["APPLICATIONS_VIEW", "COMPETITIONS_APPROVE", "STATS_VIEW", "AUDIT_VIEW"]
  },
  { label: ["Yalnız hesabatlar", "Reports only"], position: "Analitik", permissions: ["STATS_VIEW"] }
];

function PermissionPicker({
  catalogue,
  value,
  onChange
}: {
  catalogue: PermissionInfo[];
  value: Permission[];
  onChange: (next: Permission[]) => void;
}) {
  const toggle = (code: Permission, on: boolean) =>
    onChange(on ? [...new Set([...value, code])] : value.filter((p) => p !== code));
  const L = useL();
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-13 font-semibold text-ink-2">{L("Hüquqlar", "Permissions")}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {catalogue.map((p) => {
          const on = value.includes(p.code as Permission);
          return (
            <label
              key={p.code}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-sm transition-colors",
                on ? "border-primary bg-primary-50" : "border-border hover:border-primary/40"
              )}
            >
              <Checkbox className="mt-0.5" checked={on} onCheckedChange={(v) => toggle(p.code as Permission, v === true)} />
              <span>
                <span className="block font-medium">{p.label}</span>
                <span className="block text-13 text-ink-3">{p.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function StaffDialog({
  open,
  onOpenChange,
  member
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: StaffMember | null; // null: a new account
}) {
  const { data: catalogue } = usePermissionCatalogue();
  const create = useCreateStaff();
  const update = useUpdateStaff();
  const reset = useResetStaffPassword();
  const [form, setForm] = useState({ full_name: "", email: "", position: "", password: "" });
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({ full_name: member?.full_name ?? "", email: member?.email ?? "", position: member?.position ?? "", password: "" });
    setPermissions((member?.permissions as Permission[] | undefined) ?? []);
    setNewPassword("");
    create.reset();
    update.reset();
    reset.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member]);

  const L = useL();
  const pending = create.isPending || update.isPending;
  const err = (create.error ?? update.error ?? reset.error) as unknown;
  const apiError = err instanceof ApiError ? err : null;
  const fe = (name: string) => apiError?.forField(name);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (member) {
      update.mutate(
        { id: member.id, body: { full_name: form.full_name, position: form.position || null, permissions } },
        {
          onSuccess: () => {
            toast.success(`${form.full_name}: ${L("hüquqlar yeniləndi", "permissions updated")}`);
            onOpenChange(false);
          }
        }
      );
    } else {
      create.mutate(
        { ...form, position: form.position || null, permissions },
        {
          onSuccess: (u) => {
            toast.success(L(`${u.full_name} üçün hesab yaradıldı`, `Account created for ${u.full_name}`));
            onOpenChange(false);
          }
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={member ? L("İşçinin hüquqları", "Staff permissions") : L("Yeni işçi", "New staff member")}
        description={
          member
            ? L("Vəzifəni və hüquqları dəyişin. Dəyişiklik işçinin növbəti sorğusundan qüvvəyə minir.", "Change the position and permissions. The change applies from the person's next request.")
            : L("Hesabı yalnız administrator yaradır. İlkin şifrəni işçiyə təhlükəsiz yolla çatdırın.", "Only the administrator creates accounts. Hand over the initial password securely.")
        }
      >
        <form onSubmit={save} className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto pr-1" noValidate>
          <FormError message={apiError && apiError.fieldErrors.length === 0 ? apiError.message : null} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="full_name" label={L("Ad, soyad", "Full name")} required error={fe("full_name")}>
              <Input id="full_name" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </Field>
            <Field id="position" label={L("Vəzifə", "Position")} error={fe("position")}>
              <Input id="position" placeholder={L("məs. Sənəd yoxlayan mütəxəssis", "e.g. Document checker")} value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} />
            </Field>
            {!member && (
              <>
                <Field id="email" label={L("E-poçt", "E-mail")} required error={fe("email")}>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </Field>
                <Field id="password" label={L("İlkin şifrə", "Initial password")} required hint={L("8+ simvol, hərf və rəqəm", "8+ characters, letters and digits")} error={fe("password")}>
                  <PasswordInput id="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                </Field>
              </>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-13 font-semibold text-ink-2">{L("Hazır şablonlar", "Presets")}</div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label[0]}
                  type="button"
                  onClick={() => {
                    setPermissions(p.permissions);
                    setForm((f) => ({ ...f, position: f.position || p.position }));
                  }}
                  className="rounded-full border border-border px-3 py-1.5 text-13 font-medium text-ink-2 transition hover:border-primary/40 hover:text-primary"
                >
                  {L(p.label[0], p.label[1])}
                </button>
              ))}
            </div>
          </div>

          {catalogue ? (
            <PermissionPicker catalogue={catalogue} value={permissions} onChange={setPermissions} />
          ) : (
            <Skeleton className="h-40" />
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {L("Ləğv et", "Cancel")}
            </Button>
            <Button type="submit" disabled={pending || !form.full_name.trim() || (!member && (!form.email || !form.password))}>
              {pending ? L("Yadda saxlanılır…", "Saving…") : member ? L("Yadda saxla", "Save") : L("Hesabı yarat", "Create account")}
            </Button>
          </div>
        </form>

        {member && (
          <form
            className="mt-5 flex flex-wrap items-end gap-2 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              reset.mutate(
                { id: member.id, password: newPassword },
                { onSuccess: () => { toast.success(L("Yeni şifrə təyin edildi", "New password set")); setNewPassword(""); } }
              );
            }}
          >
            <Field id="new_password" label={L("Yeni şifrə təyin et", "Set a new password")} className="min-w-[220px] flex-1" error={reset.error instanceof ApiError ? reset.error.forField("password") : undefined}>
              <PasswordInput id="new_password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </Field>
            <Button type="submit" variant="secondary" disabled={reset.isPending || newPassword.length < 8}>
              <KeyRound /> {L("Şifrəni dəyiş", "Change password")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StaffList() {
  const { data: staff, isLoading } = useStaff();
  const { data: catalogue } = usePermissionCatalogue();
  const update = useUpdateStaff();
  const L = useL();
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [open, setOpen] = useState(false);
  const label = (code: string) => catalogue?.find((p) => p.code === code)?.label ?? code;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-13 font-medium text-ink-3">{L("İdarəetmə", "Administration")}</p>
          <h1 className="text-[28px] tracking-[-0.03em]">{L("İşçilər və hüquqlar", "Staff and permissions")}</h1>
          <p className="max-w-3xl text-sm text-ink-2">
            {L(
              "İdarəetmə panelinə qeydiyyat yoxdur: hesabları yalnız administrator yaradır və hər işçinin nə edə biləcəyini seçir — müraciətləri və sənədləri yoxlamaq, torpağı təklifə çıxarmaq, müsabiqəni təsdiqləmək və s.",
              "Nobody registers into the console: only the administrator creates accounts and chooses what each person may do — check applications and documents, put land on offer, approve competitions and more."
            )}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus /> {L("Yeni işçi", "New staff member")}
        </Button>
      </header>

      <Panel>
        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {staff?.map((m) => {
              const admin = m.role === "ADMIN";
              return (
                <li key={m.id} className={cn("grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)_auto] lg:items-center", !m.is_active && "opacity-55")}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{m.full_name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", admin ? "bg-ink text-accent" : "bg-primary-50 text-primary")}>
                        {ROLE_LABEL[m.role] ? L(ROLE_LABEL[m.role][0], ROLE_LABEL[m.role][1]) : m.role}
                      </span>
                      {!m.is_active && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-semibold text-ink-3">{L("Söndürülüb", "Disabled")}</span>}
                    </div>
                    <div className="truncate text-13 text-ink-2">{m.position ?? L("Vəzifə göstərilməyib", "No position given")}</div>
                    <div className="truncate text-13 text-ink-3">{m.email}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {admin ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-2xs font-semibold text-ink">
                        <ShieldCheck className="size-3.5" aria-hidden /> {L("Bütün hüquqlar", "All permissions")}
                      </span>
                    ) : m.permissions.length ? (
                      m.permissions.map((p) => (
                        <span key={p} className="rounded-full border border-border px-2.5 py-1 text-2xs font-medium text-ink-2">
                          {label(p)}
                        </span>
                      ))
                    ) : (
                      <span className="text-13 text-ink-3">{L("Hüquq verilməyib", "No permissions")}</span>
                    )}
                    {!admin && !m.custom_permissions && (
                      <span className="rounded-full bg-surface-2 px-2.5 py-1 text-2xs text-ink-3">{L("rolun standart hüquqları", "the role's default permissions")}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 lg:justify-end">
                    <span className="hidden text-2xs text-ink-3 xl:inline">
                      {m.last_login_at ? `${L("Son giriş", "Last sign-in")} ${formatDateTime(m.last_login_at)}` : L("Hələ daxil olmayıb", "Never signed in")}
                    </span>
                    {!admin && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditing(m);
                            setOpen(true);
                          }}
                        >
                          <Pencil /> {L("Hüquqlar", "Permissions")}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={update.isPending}
                          title={m.is_active ? L("Hesabı söndür", "Disable account") : L("Hesabı aktiv et", "Enable account")}
                          onClick={() =>
                            update.mutate(
                              { id: m.id, body: { is_active: !m.is_active } },
                              { onSuccess: () => toast.success(`${m.full_name}: ${m.is_active ? L("hesab söndürüldü", "account disabled") : L("hesab aktivdir", "account enabled")}`) }
                            )
                          }
                        >
                          {m.is_active ? <UserRoundX /> : <UserRoundCheck />}
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <StaffDialog open={open} onOpenChange={setOpen} member={editing} />
    </div>
  );
}

export default function StaffPage() {
  return (
    <RequireRole roles={["ADMIN"]}>
      <StaffList />
    </RequireRole>
  );
}
