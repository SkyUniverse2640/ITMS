"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/**
 * Toggle with clear inset gap between the knob and the track curve.
 * Track uses padding so the circle never sits flush on the edges.
 */
const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
    size?: "default" | "sm";
  }
>(({ className, size = "default", ...props }, ref) => {
  const isSm = size === "sm";
  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer group inline-flex shrink-0 cursor-pointer items-center rounded-full",
        "border border-border transition-colors duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Track + inset padding (gap from curve to knob)
        isSm ? "h-7 w-12 p-[3px]" : "h-8 w-14 p-1",
        // States
        "data-[state=checked]:bg-primary data-[state=checked]:hover:brightness-110",
        "data-[state=unchecked]:bg-muted-foreground/25 data-[state=unchecked]:hover:bg-muted-foreground/35",
        "dark:data-[state=unchecked]:bg-muted-foreground/30 dark:data-[state=unchecked]:hover:bg-muted-foreground/40",
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-md ring-0",
          "transition-transform duration-200 ease-out will-change-transform",
          // Thumb smaller than track; travel = track inner width − thumb
          // default: track 56×32, pad 4px → inner 48×24, thumb 24 → travel 24px
          // sm: track 48×28, pad 3px → inner 42×22, thumb 18 → travel 24px
          isSm
            ? "h-[18px] w-[18px] data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-6"
            : "h-6 w-6 data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-6",
          "group-active:scale-[0.96]"
        )}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
