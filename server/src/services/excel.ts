// Reads a day's Excel sheet and checks it before anything is saved.
//
// The flow is: readWorkbook (file -> raw rows) -> validateRows (raw rows -> preview with errors and warnings).
// validateRows is pure (no database), so the rules are easy to test. Codes XL-0xx are errors that block saving,
// XL-1xx are warnings that do not. All of them are listed in docs/troubleshooting.md.
import ExcelJS from "exceljs";
import type { MachineStatus, PreviewChange, PreviewIssue } from "@fa/shared";
import type { ExcelConfig } from "../config/schema.js";

export type ColumnKey = keyof ExcelConfig["columns"];
const REQUIRED_COLUMNS: ColumnKey[] = ["date", "shift", "machineCode", "status"];

export interface RawRow {
  row: number;
  date: unknown;
  shift: unknown;
  machineCode: unknown;
  status: unknown;
  abortCount: unknown;
  remarks: unknown;
}

export interface WorkbookReadResult {
  rows: RawRow[];
  errors: PreviewIssue[];
}

const normalise = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Turns the different kinds of ExcelJS cell values (formulas, rich text, links) into plain values. */
function cellValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value !== "object") return value;
  if ("result" in value) return cellValue(value.result as ExcelJS.CellValue);
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("text" in value) return cellValue(value.text as ExcelJS.CellValue);
  if ("error" in value) return null;
  return String(value);
}

export async function readWorkbook(buffer: Buffer, config: ExcelConfig): Promise<WorkbookReadResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { rows: [], errors: [{ row: null, code: "UPLOAD-002", message: "The file could not be read as an Excel workbook (.xlsx)." }] };
  }

  const sheet = config.sheet ? workbook.getWorksheet(config.sheet) : workbook.worksheets[0];
  if (!sheet) {
    const message = config.sheet
      ? `The workbook has no sheet named "${config.sheet}".`
      : "The workbook has no sheets.";
    return { rows: [], errors: [{ row: null, code: "XL-011", message }] };
  }

  // Find which column number holds each field, using the header names allowed in config/excel.json.
  const header = sheet.getRow(config.headerRow);
  const columnIndex: Partial<Record<ColumnKey, number>> = {};
  header.eachCell((cell, colNumber) => {
    const text = cellValue(cell.value);
    if (typeof text !== "string") return;
    for (const [key, aliases] of Object.entries(config.columns) as [ColumnKey, string[]][]) {
      if (columnIndex[key] === undefined && aliases.some((a) => normalise(a) === normalise(text))) {
        columnIndex[key] = colNumber;
      }
    }
  });

  const errors: PreviewIssue[] = [];
  for (const key of REQUIRED_COLUMNS) {
    if (columnIndex[key] === undefined) {
      errors.push({
        row: config.headerRow,
        code: "XL-001",
        message: `Column "${config.columns[key][0]}" was not found in the header row. Allowed names: ${config.columns[key].join(", ")}.`,
      });
    }
  }
  if (errors.length) return { rows: [], errors };

  const rows: RawRow[] = [];
  const get = (r: ExcelJS.Row, key: ColumnKey) => {
    const col = columnIndex[key];
    return col === undefined ? null : cellValue(r.getCell(col).value);
  };
  for (let n = config.headerRow + 1; n <= sheet.rowCount; n++) {
    const r = sheet.getRow(n);
    const raw: RawRow = {
      row: n,
      date: get(r, "date"),
      shift: get(r, "shift"),
      machineCode: get(r, "machineCode"),
      status: get(r, "status"),
      abortCount: get(r, "abortCount"),
      remarks: get(r, "remarks"),
    };
    const isEmpty = [raw.date, raw.shift, raw.machineCode, raw.status, raw.abortCount, raw.remarks].every(
      (v) => v === null || (typeof v === "string" && v.trim() === ""),
    );
    if (!isEmpty) rows.push(raw);
  }
  return { rows, errors };
}

const pad = (n: number) => String(n).padStart(2, "0");

function validDate(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Returns "YYYY-MM-DD" or null. Accepts real Excel dates, Excel serial numbers and text in the configured formats. */
export function parseDate(value: unknown, formats: ExcelConfig["dateFormats"]): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return validDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === "number" && value > 0 && value < 2958466) {
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return validDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  for (const format of formats) {
    const sep = format.includes("/") ? "/" : "-";
    const parts = text.split(sep);
    if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) continue;
    const [a, b, c] = parts.map(Number) as [number, number, number];
    let result: string | null = null;
    if (format === "YYYY-MM-DD" && parts[0]!.length === 4) result = validDate(a, b, c);
    if ((format === "DD-MM-YYYY" || format === "DD/MM/YYYY") && parts[2]!.length === 4) result = validDate(c, b, a);
    if (format === "MM/DD/YYYY" && parts[2]!.length === 4) result = validDate(c, a, b);
    if (result) return result;
  }
  return null;
}

export function parseShift(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value !== "string") return null;
  const match = /^(?:shift\s*|s)?(\d+)$/i.exec(value.trim());
  return match ? Number(match[1]) : null;
}

function parseStatus(value: unknown, config: ExcelConfig): MachineStatus | null {
  if (typeof value !== "string") return null;
  const key = normalise(value);
  for (const [status, words] of Object.entries(config.statusValues) as [MachineStatus, string[]][]) {
    if (words.some((w) => normalise(w) === key)) return status;
  }
  return null;
}

function parseAbortCount(value: unknown): number | null {
  if (value === null || (typeof value === "string" && value.trim() === "")) return 0;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isInteger(n) && n >= 0 && n <= 100000 ? n : null;
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export interface ValidationContext {
  shiftsPerDay: number;
  machines: { id: number; code: string; name: string }[];
  /** Status already saved for this day, keyed by `${machineId}:${shift}`. */
  previous: Map<string, MachineStatus>;
  config: ExcelConfig;
  today: string;
}

export interface ValidRow {
  row: number;
  machineId: number;
  shift: number;
  status: MachineStatus;
  abortCount: number;
  remarks: string;
}

export interface ValidationResult {
  workDate: string | null;
  changes: PreviewChange[];
  validRows: ValidRow[];
  errors: PreviewIssue[];
  warnings: PreviewIssue[];
}

export function validateRows(rows: RawRow[], ctx: ValidationContext): ValidationResult {
  const errors: PreviewIssue[] = [];
  const warnings: PreviewIssue[] = [];
  const changes: PreviewChange[] = [];
  const validRows: ValidRow[] = [];

  if (rows.length === 0) {
    errors.push({ row: null, code: "XL-009", message: "The sheet has a header but no data rows." });
    return { workDate: null, changes, validRows, errors, warnings };
  }
  if (rows.length > ctx.config.maxRows) {
    errors.push({ row: null, code: "XL-010", message: `The sheet has ${rows.length} rows. The limit is ${ctx.config.maxRows}.` });
    return { workDate: null, changes, validRows, errors, warnings };
  }

  const machinesByCode = new Map(ctx.machines.map((m) => [normalise(m.code), m]));
  const seen = new Map<string, number>();
  let workDate: string | null = null;

  for (const raw of rows) {
    const rowErrors: PreviewIssue[] = [];
    const add = (code: string, message: string) => rowErrors.push({ row: raw.row, code, message: `Row ${raw.row}: ${message}` });

    const date = parseDate(raw.date, ctx.config.dateFormats);
    if (!date) {
      add("XL-002", `"${asText(raw.date)}" is not a valid date. Use one of: ${ctx.config.dateFormats.join(", ")}.`);
    } else if (workDate === null) {
      workDate = date;
    } else if (date !== workDate) {
      add("XL-003", `date ${date} is different from ${workDate} in the first row. One file must contain one day only.`);
    }

    const shift = parseShift(raw.shift);
    if (shift === null || shift < 1 || shift > ctx.shiftsPerDay) {
      add("XL-004", `shift "${asText(raw.shift)}" is not valid. This factory has shifts 1 to ${ctx.shiftsPerDay}.`);
    }

    const code = asText(raw.machineCode);
    const machine = machinesByCode.get(normalise(code));
    if (!code) add("XL-005", "the machine ID is empty.");
    else if (!machine) add("XL-005", `machine "${code}" does not exist in this factory.`);

    const status = parseStatus(raw.status, ctx.config);
    if (!status) {
      const allowed = Object.values(ctx.config.statusValues).map((w) => w[0]).join(", ");
      add("XL-006", `status "${asText(raw.status)}" is not recognised. Use one of: ${allowed}.`);
    }

    const abortCount = parseAbortCount(raw.abortCount);
    if (abortCount === null) add("XL-007", `abort count "${asText(raw.abortCount)}" must be a whole number, 0 or more.`);

    if (machine && shift !== null) {
      const key = `${machine.id}:${shift}`;
      const firstRow = seen.get(key);
      if (firstRow !== undefined) add("XL-008", `machine ${machine.code}, shift ${shift} already appears in row ${firstRow}.`);
      else seen.set(key, raw.row);
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      continue;
    }
    const remarks = asText(raw.remarks).slice(0, 500);
    validRows.push({ row: raw.row, machineId: machine!.id, shift: shift!, status: status!, abortCount: abortCount!, remarks });
    changes.push({
      row: raw.row,
      machineCode: machine!.code,
      machineName: machine!.name,
      shift: shift!,
      previousStatus: ctx.previous.get(`${machine!.id}:${shift}`) ?? null,
      newStatus: status!,
      abortCount: abortCount!,
      remarks,
    });
  }

  if (errors.length === 0) {
    for (const m of ctx.machines) {
      for (let s = 1; s <= ctx.shiftsPerDay; s++) {
        if (!seen.has(`${m.id}:${s}`)) {
          warnings.push({ row: null, code: "XL-101", message: `${m.code} (${m.name}) has no row for shift ${s}. Its status for that shift will not change.` });
        }
      }
    }
    if (workDate && workDate > ctx.today) {
      warnings.push({ row: null, code: "XL-102", message: `The date ${workDate} is in the future. Check that it is correct.` });
    }
  }

  return { workDate, changes, validRows, errors, warnings };
}

/** Builds the blank sheet users download: one row per machine and shift, with the date filled in. */
export async function buildTemplate(
  config: ExcelConfig,
  factoryName: string,
  shiftsPerDay: number,
  machines: { code: string; name: string }[],
  workDate: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheetName = config.sheet || "Daily status";
  const sheet = workbook.addWorksheet(sheetName);
  const headers = [
    config.columns.date[0]!,
    config.columns.shift[0]!,
    config.columns.machineCode[0]!,
    "Machine name",
    config.columns.status[0]!,
    config.columns.abortCount[0]!,
    config.columns.remarks[0]!,
  ];
  for (let i = 1; i < config.headerRow; i++) sheet.addRow([i === 1 ? factoryName : ""]);
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  const [y, mo, d] = workDate.split("-").map(Number) as [number, number, number];
  const dateCell = new Date(Date.UTC(y, mo - 1, d));
  for (const m of machines) {
    for (let s = 1; s <= shiftsPerDay; s++) sheet.addRow([dateCell, s, m.code, m.name, "", 0, ""]);
  }
  sheet.getColumn(1).numFmt = "yyyy-mm-dd";
  sheet.columns.forEach((col, i) => (col.width = [12, 7, 14, 28, 14, 12, 30][i] ?? 14));

  const statusWords = Object.values(config.statusValues).map((w) => w[0]!);
  const lastRow = config.headerRow + machines.length * shiftsPerDay;
  for (let r = config.headerRow + 1; r <= lastRow; r++) {
    sheet.getCell(r, 5).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`"${statusWords.join(",")}"`],
      showErrorMessage: true,
      errorTitle: "Status",
      error: `Choose one of: ${statusWords.join(", ")}`,
    };
  }

  const help = workbook.addWorksheet("Allowed values");
  help.addRow(["Status", "Words accepted"]).font = { bold: true };
  for (const [status, words] of Object.entries(config.statusValues)) help.addRow([status, words.join(", ")]);
  help.addRow([]);
  help.addRow(["Date formats", config.dateFormats.join(", ")]);
  help.columns.forEach((col) => (col.width = 30));

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
