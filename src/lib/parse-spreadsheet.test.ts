import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseSpreadsheetFile } from "./parse-spreadsheet.ts";

test("parses XLSX rows and normalizes headers", async () => {
  const fixture = await readFile(new URL("./__fixtures__/users.xlsx", import.meta.url));
  const file = new File([fixture], "users.xlsx");

  assert.deepEqual(await parseSpreadsheetFile(file), [
    { display_name: "Ada Lovelace", employee_id: "EMP-001" },
  ]);
});

test("rejects legacy XLS files", async () => {
  const file = new File([new Uint8Array()], "users.xls");
  await assert.rejects(() => parseSpreadsheetFile(file), /Use \.csv or \.xlsx/);
});
