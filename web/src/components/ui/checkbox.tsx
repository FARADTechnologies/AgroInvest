"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export const Checkbox = forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer size-4 shrink-0 rounded-sm border border-border-strong bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-fg disabled:opacity-50 aria-[invalid=true]:border-danger",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center">
      <Check className="size-3.5" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";
