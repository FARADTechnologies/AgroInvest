"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";

import { useL } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { Input } from "./input";

/** Password field with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(
  ({ className, ...props }, ref) => {
    const L = useL();
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={visible ? "text" : "password"} className={cn("pr-11", className)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? L("Şifrəni gizlət", "Hide password") : L("Şifrəni göstər", "Show password")}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 transition hover:bg-surface-2 hover:text-ink"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
