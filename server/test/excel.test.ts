import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { loadConfig } from "../src/node/load-config.js";
import { buildTemplate, parseDate, readWorkbook, validateRows, type ValidationContext } from "../src/core/services/excel.js";
import { CONFIG_DIR, HEADER, makeSheet } from "./helpers.js";

const config = loadConfig(CONFIG_DIR).excel;
const machines = [
  { id: 1, code: "M-01", name: "CNC" },
  { id: 2, code: "M-02", name: "Lathe" },
];
const ctx = (over: Partial<ValidationContext> = {}): ValidationContext => ({
  shiftsPerDay: 2,
  machines,
  previous: new Map(),
  config,
  today: "2026-10-19",
  ...over,
});

async function check(rows: unknown[][], header = HEADER, over: Partial<ValidationContext> = {}) {
  const read = await readWorkbook(await makeSheet(header, rows), config);
  if (read.errors.length) return { ...read, result: null };
  return { ...read, result: validateRows(read.rows, ctx(over)) };
}

describe("parseDate", () => {
  it("accepts the configured text formats and real dates", () => {
    expect(parseDate("2026-10-19", config.dateFormats)).toBe("2026-10-19");
    expect(parseDate("19-10-2026", config.dateFormats)).toBe("2026-10-19");
    expect(parseDate("19/10/2026", config.dateFormats)).toBe("2026-10-19");
    expect(parseDate(new Date(Date.UTC(2026, 9, 19)), config.dateFormats)).toBe("2026-10-19");
    expect(parseDate(46314, config.dateFormats)).toBe("2026-10-19");
  });

  it("rejects impossible dates and other text", () => {
    expect(parseDate("31-02-2026", config.dateFormats)).toBeNull();
    expect(parseDate("tomorrow", config.dateFormats)).toBeNull();
    expect(parseDate(null, config.dateFormats)).toBeNull();
  });
});

describe("Excel validation", () => {
  it("a complete correct sheet can be confirmed and lists every change", async () => {
    const { result } = await check(
      [
        ["2026-10-19", 1, "M-01", "Running", 0, ""],
        ["2026-10-19", 2, "M-01", "Aborted", 2, "Spindle alarm"],
        ["2026-10-19", 1, "m-02", "run", "", ""],
        ["2026-10-19", "Shift 2", "M-02", "Shift Ended", 0, ""],
      ],
      HEADER,
      { previous: new Map([["1:2", "running"]]) },
    );
    expect(result!.errors).toEqual([]);
    expect(result!.warnings).toEqual([]);
    expect(result!.workDate).toBe("2026-10-19");
    expect(result!.validRows).toHaveLength(4);
    const aborted = result!.changes.find((c) => c.machineCode === "M-01" && c.shift === 2)!;
    expect(aborted).toMatchObject({ previousStatus: "running", newStatus: "aborted", abortCount: 2, remarks: "Spindle alarm" });
  });

  it("accepts other header names listed in excel.json", async () => {
    const { result, errors } = await check([["19/10/2026", 1, "M-01", "R"]], ["Work Date", "Shift No", "M/C No.", "Machine Status"]);
    expect(errors).toEqual([]);
    expect(result!.errors).toEqual([]);
  });

  it("reports a missing required column", async () => {
    const { errors } = await check([["2026-10-19", 1, "Running"]], ["Date", "Shift", "Status"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: "XL-001" });
    expect(errors[0]!.message).toContain("Machine ID");
  });

  it("gives one clear error per problem, with the row number", async () => {
    const { result } = await check([
      ["2026-10-19", 1, "M-01", "Running", 0, ""],
      ["2026-10-20", 1, "M-02", "Running", 0, ""],
      ["2026-10-19", 3, "M-02", "Running", 0, ""],
      ["2026-10-19", 1, "M-99", "Running", 0, ""],
      ["2026-10-19", 2, "M-01", "Broken", 0, ""],
      ["2026-10-19", 2, "M-02", "Running", -1, ""],
      ["2026-10-19", 1, "M-01", "Stopped", 0, ""],
      ["not a date", 2, "M-02", "Running", 0, ""],
    ]);
    const codes = result!.errors.map((e) => `${e.row}:${e.code}`);
    expect(codes).toEqual(["3:XL-003", "4:XL-004", "5:XL-005", "6:XL-006", "7:XL-007", "8:XL-008", "9:XL-002", "9:XL-008"]);
    expect(result!.errors.find((e) => e.code === "XL-005")!.message).toContain('machine "M-99" does not exist');
  });

  it("warns, without blocking, about machines missing from the sheet and future dates", async () => {
    const { result } = await check([["2026-10-25", 1, "M-01", "Running"]]);
    expect(result!.errors).toEqual([]);
    expect(result!.warnings.map((w) => w.code).sort()).toEqual(["XL-101", "XL-101", "XL-101", "XL-102"]);
  });

  it("an empty sheet cannot be confirmed", async () => {
    const { result } = await check([]);
    expect(result!.errors[0]).toMatchObject({ code: "XL-009" });
  });

  it("a file that is not Excel is reported, not crashed on", async () => {
    const read = await readWorkbook(Buffer.from("hello, this is a csv"), config);
    expect(read.errors[0]).toMatchObject({ code: "UPLOAD-002" });
  });

  it("the downloadable template, once filled in, passes validation", async () => {
    const buffer = await buildTemplate(config, "Test Factory", 2, machines, "2026-10-19");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    for (let r = 2; r <= ws.rowCount; r++) ws.getCell(r, 5).value = "Running";
    const filled = Buffer.from(await wb.xlsx.writeBuffer());
    const read = await readWorkbook(filled, config);
    expect(read.errors).toEqual([]);
    const result = validateRows(read.rows, ctx());
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.validRows).toHaveLength(4);
    expect(result.workDate).toBe("2026-10-19");
  });
});
