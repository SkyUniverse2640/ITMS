"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Truncates content and shows a tooltip with the full text when hovered
 * (useful after column resize clips cell content).
 */
export function TruncateTooltip({
  text,
  className,
  children,
  side = "top",
}: {
  /** Plain text used for tooltip (and as children if children omitted) */
  text?: string | number | null;
  className?: string;
  children?: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const full = text == null || text === "" ? "" : String(text);
  const content = children ?? full;

  if (!full && !children) {
    return <span className={cn("truncate", className)}>—</span>;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("block truncate max-w-full cursor-default", className)}>
            {content}
          </span>
        </TooltipTrigger>
        {full ? (
          <TooltipContent side={side} className="max-w-sm break-words whitespace-pre-wrap">
            {full}
          </TooltipContent>
        ) : null}
      </Tooltip>
    </TooltipProvider>
  );
}

/** Resize handle with tooltip — drop on th edge */
export function ColumnResizeHandle({
  onMouseDown,
  label = "Drag to resize column",
}: {
  onMouseDown: (e: React.MouseEvent) => void;
  label?: string;
}) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="separator"
            aria-orientation="vertical"
            aria-label={label}
            title={label}
            onMouseDown={onMouseDown}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 z-[2] h-full w-2 cursor-col-resize group/resize"
          >
            <span className="absolute right-0 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-full bg-border group-hover/resize:bg-primary group-active/resize:bg-primary" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[11px]">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
