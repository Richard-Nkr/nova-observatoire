import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[3px] text-[12.5px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-navy text-white hover:bg-navy-soft border border-navy shadow-[0_1px_1px_rgba(15,36,51,0.12)]",
        accent:
          "bg-accent text-white hover:bg-accent-strong border border-accent-strong",
        outline:
          "border border-line-strong bg-surface text-ink hover:bg-white hover:border-line-strong",
        ghost: "text-ink-soft hover:bg-black/[0.045] hover:text-ink",
        subtle: "bg-black/[0.045] text-ink hover:bg-black/[0.07]",
        danger: "bg-danger text-white hover:bg-[#8a3029]",
        link: "text-accent underline-offset-2 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-7 px-2.5 [&_svg]:size-3.5",
        md: "h-8 px-3 [&_svg]:size-4",
        lg: "h-9 px-4 [&_svg]:size-4",
        icon: "size-8 [&_svg]:size-4",
        iconSm: "size-7 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
