import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-3 disabled:cursor-not-allowed disabled:bg-surface-2 aria-[invalid=true]:border-danger",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-24 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 disabled:cursor-not-allowed disabled:bg-surface-2 aria-[invalid=true]:border-danger",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
