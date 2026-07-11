/**
 * Reliable client-side template download.
 * Prefer API (/api/templates/:kind) so files always match DB columns
 * even if public/Templates is missing. Falls back to client-generated CSV.
 */

import {
  getImportTemplateCsv,
  getImportTemplateFilename,
  type TemplateKind,
} from "@/lib/parse-spreadsheet";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Delay revoke so browser can start download
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function downloadFromCsvString(csv: string, filename: string) {
  // BOM for Excel
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  triggerBlobDownload(blob, filename);
}

/** Download import template by kind. Never depends on static public files alone. */
export async function downloadImportTemplate(kind: TemplateKind): Promise<void> {
  const filename = getImportTemplateFilename(kind);

  try {
    const res = await fetch(`/api/templates/${kind}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    if (res.ok) {
      const blob = await res.blob();
      // Ensure filename even if server disposition is ignored
      triggerBlobDownload(blob, filename);
      return;
    }
  } catch {
    /* fall through to client CSV */
  }

  // Client-side fallback — always works offline of static files
  downloadFromCsvString(getImportTemplateCsv(kind), filename);
}
