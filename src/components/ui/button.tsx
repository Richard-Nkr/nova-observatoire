import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-[11.5px] font-semibold tracking-[0.01em] transition-[background-color,border-color,color,box-shadow] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "border border-navy bg-navy text-white shadow-[0_1px_2px_rgba(15,36,51,0.14)] hover:bg-navy-soft",
        accent:
          "border border-accent bg-accent text-white shadow-[0_1px_2px_rgba(193,95,47,0.2)] hover:bg-accent-strong",
        outline:
          "border border-line-strong bg-surface text-ink hover:border-[#b9c4d3] hover:bg-paper",
        ghost: "text-ink-soft hover:bg-paper hover:text-ink",
        subtle: "bg-[#e9edf3] text-ink hover:bg-[#e0e6ee]",
        danger: "bg-danger text-white hover:bg-[#8a3029]",
        link: "text-accent underline-offset-2 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-7 px-3 [&_svg]:size-3.5",
        md: "h-8 px-3.5 [&_svg]:size-4",
        lg: "h-9 px-4.5 [&_svg]:size-4",
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
