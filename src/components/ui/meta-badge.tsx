"use client";

import { cn } from "@/lib/utils";
import { colorBadgeStyle, useTicketMeta } from "@/components/providers/ticket-meta-provider";

type BadgeSize = "sm" | "md";

const sizeClass: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-0.5 text-xs",
};

const baseClass =
  "inline-flex items-center rounded-full font-semibold border border-transparent text-white";

/** Ticket status chip — color comes from Ticket Settings (live). */
export function StatusBadge({
  status,
  className,
  size = "sm",
}: {
  status: string;
  className?: string;
  size?: BadgeSize;
}) {
  const { getStatusColor } = useTicketMeta();
  return (
    <span
      className={cn(baseClass, sizeClass[size], className)}
      style={colorBadgeStyle(getStatusColor(status))}
    >
      {status}
    </span>
  );
}

/** Priority / urgency chip — color from Ticket Settings priorities (live). */
export function PriorityBadge({
  priority,
  className,
  size = "sm",
}: {
  priority: string;
  className?: string;
  size?: BadgeSize;
}) {
  const { getPriorityColor } = useTicketMeta();
  return (
    <span
      className={cn(baseClass, sizeClass[size], className)}
      style={colorBadgeStyle(getPriorityColor(priority))}
    >
      {priority}
    </span>
  );
}
