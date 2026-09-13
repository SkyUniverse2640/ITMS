"use client";

import { type Key, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

// Adapted from React Bits AnimatedList (TS-TW source SHA 9b002215f05a79d14cfc413c00b7027edea72a4a).
// See THIRD_PARTY_NOTICES.md for license terms.
export interface AnimatedListItem {
  key: Key;
  content: ReactNode;
}

export function AnimatedList({
  items,
  className,
}: {
  items: readonly AnimatedListItem[];
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn("divide-y", className)}>
      <AnimatePresence initial={!reduceMotion}>
        {items.map((item, index) => (
          <motion.div
            key={item.key}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.2, delay: Math.min(index * 0.035, 0.21) }
            }
          >
            {item.content}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
