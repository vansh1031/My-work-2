import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config/load.js";
import { CONFIG_DIR } from "./helpers.js";

function copyConfig() {
  const dir = mkdtempSync(path.join(tmpdir(), "fa-config-"));
  cpSync(CONFIG_DIR, dir, { recursive: true });
  return dir;
}

describe("config", () => {
  it("the shipped config folder is valid", () => {
    expect(() => loadConfig(CONFIG_DIR)).not.toThrow();
  });

  it("names the file and field when a value is wrong", () => {
    const dir = copyConfig();
    const theme = JSON.parse(readFileSync(path.join(dir, "theme.json"), "utf8"));
    theme.statusColors.running = "green";
    writeFileSync(path.join(dir, "theme.json"), JSON.stringify(theme));
    try {
      loadConfig(dir);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).problems.join("\n")).toContain("theme.json -> statusColors.running");
    }
  });

  it("reports broken JSON and missing logo files", () => {
    const dir = copyConfig();
    writeFileSync(path.join(dir, "animation.json"), "{ not json");
    const branding = JSON.parse(readFileSync(path.join(dir, "branding.json"), "utf8"));
    branding.logo = "assets/missing.svg";
    writeFileSync(path.join(dir, "branding.json"), JSON.stringify(branding));
    const problems = (() => {
      try {
        loadConfig(dir);
        return [];
      } catch (err) {
        return (err as ConfigError).problems;
      }
    })();
    expect(problems.some((p) => p.startsWith("animation.json: not valid JSON"))).toBe(true);
    expect(problems.some((p) => p.includes("branding.json -> logo"))).toBe(true);
  });

  it("rejects the same Excel column name used for two fields", () => {
    const dir = copyConfig();
    const excel = JSON.parse(readFileSync(path.join(dir, "excel.json"), "utf8"));
    excel.columns.remarks.push("Status");
    writeFileSync(path.join(dir, "excel.json"), JSON.stringify(excel));
    expect(() => loadConfig(dir)).toThrow(/"Status" is listed for both status and remarks/);
  });
});
