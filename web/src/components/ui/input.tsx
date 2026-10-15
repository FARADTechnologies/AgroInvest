import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-border bg-surface-2/60 px-3.5 text-sm text-ink transition-colors placeholder:text-ink-3 hover:border-border-strong focus:border-primary/60 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-surface-2 aria-[invalid=true]:border-danger",
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
      "flex min-h-24 w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-ink-3 hover:border-border-strong focus:border-primary/60 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-surface-2 aria-[invalid=true]:border-danger",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
