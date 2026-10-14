import { FileCheck2, MapPinned, ShieldCheck } from "lucide-react";

const POINTS = [
  {
    icon: MapPinned,
    title: "Sahələri xəritədə seçin",
    text: "Təyinat, ölçü və istifadə şərtlərinə görə təsərrüfat sahələrini müqayisə edin."
  },
  {
    icon: FileCheck2,
    title: "Elektron müraciət edin",
    text: "Biznes planı və sənədləri onlayn təqdim edin, müraciət nömrəsini dərhal alın."
  },
  {
    icon: ShieldCheck,
    title: "Statusu izləyin",
    text: "Hər mərhələ, səbəb və qərar tarixçədə görünür, bildirişlər kabinetə gəlir."
  }
];

/** Two-column frame for sign-in and registration: the form and what the portal offers. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-[minmax(0,420px)_1fr] md:py-16 lg:px-6">
      <div>{children}</div>
      <aside className="hidden border-l border-border pl-10 md:block">
        <p className="text-13 font-medium uppercase tracking-wide text-ink-3">Portal haqqında</p>
        <ul className="mt-5 space-y-6">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
                <Icon className="size-4" aria-hidden />
              </span>
              <div>
                <p className="font-medium text-ink">{title}</p>
                <p className="mt-0.5 text-sm text-ink-2">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
