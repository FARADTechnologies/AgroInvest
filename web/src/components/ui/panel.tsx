import { cn } from "@/lib/utils";

/** Card surface: white, rounded, with a soft lift. */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border/70 bg-surface shadow-card", className)} {...props} />;
}

export function PanelHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4", className)}
      {...props}
    />
  );
}

export function PanelTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-15 font-semibold", className)} {...props} />;
}

export function PanelBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-[shimmer_1.6s_linear_infinite] rounded-xl bg-[linear-gradient(90deg,rgb(var(--surface-2))_0%,rgb(var(--border)/0.6)_50%,rgb(var(--surface-2))_100%)] bg-[length:200%_100%]",
        className
      )}
      {...props}
    />
  );
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn("h-px w-full bg-border", className)} />;
}
