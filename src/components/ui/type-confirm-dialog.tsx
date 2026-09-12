"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Type-to-confirm delete:
 * "Are you sure want delete ${object}? Type ${object} below to confirm"
 */
export function TypeConfirmDialog({
  open,
  onOpenChange,
  objectName,
  title,
  actionVerb = "delete",
  confirmButtonLabel,
  onConfirm,
  confirming = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Exact string the user must type (usually display name) */
  objectName: string;
  title?: string;
  /** e.g. "delete" | "deactivate" */
  actionVerb?: string;
  confirmButtonLabel?: string;
  onConfirm: () => void | Promise<void>;
  confirming?: boolean;
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) setTyped("");
  }, [open, objectName]);

  const match = typed === objectName;
  const canConfirm = match && !confirming && objectName.length > 0;
  const verb = actionVerb.trim() || "delete";
  const dialogTitle = title || `Confirm ${verb}`;
  const btnLabel = confirmButtonLabel || (verb === "delete" ? "Delete" : verb.charAt(0).toUpperCase() + verb.slice(1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription className="space-y-2 text-left">
            <span className="block text-foreground">
              Are you sure want {verb}{" "}
              <strong className="font-semibold text-foreground">{objectName || "this item"}</strong>?
            </span>
            <span className="block">
              Type <strong className="font-semibold text-foreground">{objectName || "…"}</strong>{" "}
              below to confirm
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <Label htmlFor="type-confirm-input">Confirmation</Label>
          <Input
            id="type-confirm-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={objectName}
            autoComplete="off"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && canConfirm) void onConfirm();
            }}
          />
          {typed.length > 0 && !match && (
            <p className="text-xs text-destructive">Name does not match</p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => void onConfirm()}
          >
            {confirming ? "Working..." : btnLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
