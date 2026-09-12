"use client";

import { useState } from "react";
import { Pencil, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TypeConfirmDialog } from "@/components/ui/type-confirm-dialog";

/**
 * Single gear (Settings) action for admin rows:
 * - Edit
 * - Delete (with type-to-confirm using objectName)
 */
export function RowSettingsMenu({
  objectName,
  onEdit,
  onDelete,
  deleteLabel = "Delete",
  editLabel = "Edit",
  actionVerb = "delete",
  align = "end",
  showDelete = true,
}: {
  /** Name that must be typed to confirm delete */
  objectName: string;
  onEdit: () => void;
  onDelete?: () => void | Promise<void>;
  deleteLabel?: string;
  editLabel?: string;
  /** Shown in confirm: "Are you sure want {actionVerb} …" */
  actionVerb?: string;
  align?: "start" | "end" | "center";
  /** Set false when only Edit is available */
  showDelete?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Settings"
            aria-label={`Settings for ${objectName}`}
          >
            <Settings2 className="h-4 w-4 stroke-[2.25]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-44">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              onEdit();
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            {editLabel}
          </DropdownMenuItem>
          {showDelete && onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="menu-item-delete cursor-pointer"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="menu-item-delete-icon mr-2 h-4 w-4" />
                {deleteLabel}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showDelete && onDelete && (
        <TypeConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          objectName={objectName}
          actionVerb={actionVerb}
          confirmButtonLabel={deleteLabel}
          onConfirm={confirmDelete}
          confirming={deleting}
        />
      )}
    </>
  );
}
