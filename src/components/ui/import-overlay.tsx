"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, FileSpreadsheet, ImageIcon } from "lucide-react";

export type ImportOverlayKind = "spreadsheet" | "image" | "generic";

interface ImportOverlayProps {
  /** When true the overlay is shown and page interaction is blocked */
  open: boolean;
  /** Primary label, e.g. "Importing users…" */
  label?: string;
  /** Optional secondary detail, e.g. the file name or row count */
  detail?: string;
  /** Icon accent for the operation type */
  kind?: ImportOverlayKind;
}

/**
 * Full-screen blocking overlay shown while importing CSV/XLSX rows or
 * uploading images. Dims the page, centers a spinner + label, and prevents
 * interaction (including background scroll) until the operation finishes.
 *
 * Rendered via a portal to document.body so it always covers the viewport
 * regardless of the parent's stacking/overflow context.
 */
export function ImportOverlay({
  open,
  label = "Processing…",
  detail,
  kind = "generic",
}: ImportOverlayProps) {
  // Lock background scroll while the overlay is visible.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const KindIcon =
    kind === "spreadsheet" ? FileSpreadsheet : kind === "image" ? ImageIcon : Loader2;

  return createPortal(
    <div
      role="alertdialog"
      aria-busy="true"
      aria-live="assertive"
      aria-label={label}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4 rounded-xl border bg-card px-8 py-7 shadow-lg">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <KindIcon className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {detail ? (
            <p className="mt-1 max-w-[18rem] truncate text-xs text-muted-foreground" title={detail}>
              {detail}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Please keep this tab open until it finishes.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
