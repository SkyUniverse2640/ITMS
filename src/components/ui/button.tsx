import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
    "cursor-pointer select-none",
    "transition-all duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
    "active:scale-[0.98]",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary solid — hover darker blue (jelas)
        default: [
          "bg-blue-600 text-white shadow-sm",
          "hover:bg-blue-700 hover:text-white hover:shadow-md",
          "active:bg-blue-800",
          "dark:bg-blue-600 dark:hover:bg-blue-500 dark:active:bg-blue-700",
          "[&_svg]:text-white [&_svg]:stroke-white",
        ].join(" "),

        destructive: [
          /* Ancient red — same in every system color theme */
          "bg-[#9B1C1C] text-white shadow-sm",
          "hover:bg-[#7F1D1D] hover:text-white hover:shadow-md",
          "active:bg-[#5C1010]",
          "dark:bg-[#9B1C1C] dark:hover:bg-[#B91C1C]",
          "[&_svg]:text-white [&_svg]:stroke-white",
        ].join(" "),

        outline: [
          "border border-border bg-background text-foreground shadow-sm",
          "hover:bg-accent hover:text-accent-foreground hover:border-blue-400",
          "dark:hover:bg-accent dark:hover:text-accent-foreground dark:hover:border-blue-500",
          "[&_svg]:text-current [&_svg]:stroke-[2.25]",
        ].join(" "),

        secondary: [
          "bg-secondary text-secondary-foreground shadow-sm",
          "hover:bg-slate-200 dark:hover:bg-slate-600",
          "[&_svg]:text-current [&_svg]:stroke-[2.25]",
        ].join(" "),

        ghost: [
          "bg-transparent text-foreground",
          "hover:bg-accent hover:text-accent-foreground",
          "dark:hover:bg-accent dark:hover:text-accent-foreground",
          "[&_svg]:text-current [&_svg]:stroke-[2.25]",
        ].join(" "),

        // Link
        link: [
          "text-blue-600 underline-offset-4 bg-transparent",
          "hover:text-blue-800 hover:underline",
          "dark:text-blue-400 dark:hover:text-blue-300",
        ].join(" "),
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
