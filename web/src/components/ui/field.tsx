import { CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

import { Label } from "./label";

/** Label, control, hint and error message, wired for screen readers. */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  children
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1 text-13 text-danger">
          <CircleAlert className="size-3.5" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-13 text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-50 px-3 py-2 text-sm text-danger"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </div>
  );
}
