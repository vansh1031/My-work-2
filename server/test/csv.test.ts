import { describe, expect, it } from "vitest";
import { toCsv } from "@fa/shared";

describe("toCsv", () => {
  it("starts with a byte order mark and uses Windows line ends", () => {
    expect(toCsv(["A", "B"], [[1, "x"]])).toBe("﻿A,B\r\n1,x\r\n");
  });

  it("quotes commas, quotes and line breaks", () => {
    const text = toCsv(["R"], [["a,b"], ['say "hi"'], ["two\nlines"]]);
    expect(text).toContain('"a,b"');
    expect(text).toContain('"say ""hi"""');
    expect(text).toContain('"two\nlines"');
  });

  it("stops Excel from running remarks as formulas", () => {
    const text = toCsv(["R"], [["=1+1"], ["+SUM(A1)"], ["-2"], ["@cmd"]]);
    expect(text).toContain("'=1+1");
    expect(text).toContain("'+SUM(A1)");
    expect(text).toContain("'-2");
    expect(text).toContain("'@cmd");
  });

  it("leaves numbers alone, even negative ones, and writes empty cells for missing values", () => {
    expect(toCsv(["N", "E"], [[-3, null]])).toBe("﻿N,E\r\n-3,\r\n");
  });
});
