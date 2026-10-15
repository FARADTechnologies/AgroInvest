import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-200 ease-spring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg shadow-[0_6px_16px_-8px_rgb(19_67_47/0.7)] hover:bg-primary-hover hover:shadow-[0_10px_22px_-10px_rgb(19_67_47/0.8)]",
        lime: "bg-accent text-ink hover:bg-accent-strong",
        secondary: "border border-border bg-surface text-ink shadow-card hover:border-border-strong hover:bg-surface-2",
        ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        danger: "bg-danger text-white hover:bg-danger/90",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline"
      },
      size: {
        sm: "h-8 px-3.5 text-13",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-6 text-15",
        icon: "size-10"
      }
    },
    defaultVariants: { variant: "primary", size: "md" }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  }
);
Button.displayName = "Button";

export { buttonVariants };
