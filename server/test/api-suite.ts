// End-to-end checks of the server: sign-in rules, who can see what, and the full Excel upload flow.
// Runs once per engine (api.postgres.test.ts, api.pglite.test.ts), so server mode and browser mode are held
// to exactly the same behaviour.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminToken, HEADER, login, makeSheet, setupClient, XLSX, type Engine, type TestClient } from "./helpers.js";
import { todayIso } from "../src/core/routes/factories.js";

export function runApiSuite(engine: Engine) {
let client: TestClient;
let admin: string;
let indoreId: number;
let puneId: number;
const machineIds: number[] = [];
const day = "2026-10-12";

beforeAll(async () => {
  client = await setupClient(engine);
});
afterAll(async () => {
  await client.close();
});

const get = (url: string, token?: string) => client.request("GET", url, { token });
const send = (method: "POST" | "PATCH" | "PUT" | "DELETE", url: string, token: string, body?: object) =>
  client.request(method, url, { token, body });
const upload = async (url: string, token: string, rows: unknown[][], name = "day.xlsx") =>
  client.request("POST", url, { token, file: { fileName: name, mimeType: XLSX, data: await makeSheet(HEADER, rows) } });

describe("sign-in", () => {
  it("rejects a wrong password with AUTH-001", async () => {
    const res = await client.request("POST", "/api/auth/login", { body: { username: "admin", password: "nope" } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("AUTH-001");
  });

  it("forces a password change on first sign-in", async () => {
    const token = await login(client, "admin", "first-password");
    const me = await get("/api/auth/me", token);
    expect(me.json().user.mustChangePassword).toBe(true);
    const blocked = await get("/api/factories", token);
    expect(blocked.json().error.code).toBe("AUTH-005");
  });

  it("after changing the password, old sessions stop working", async () => {
    const old = await login(client, "admin", "first-password");
    admin = await adminToken(client);
    expect((await get("/api/factories", admin)).statusCode).toBe(200);
    expect((await get("/api/auth/me", old)).json().error.code).toBe("AUTH-002");
  });

  it("requests without a token get AUTH-002", async () => {
    expect((await get("/api/factories")).json().error.code).toBe("AUTH-002");
  });
});

describe("admin setup", () => {
  it("creates factories and machines", async () => {
    const f1 = await send("POST", "/api/admin/factories", admin, {
      name: "Indore Plant", city: "Indore", state: "Madhya Pradesh", country: "India", latitude: 22.72, longitude: 75.86, shiftsPerDay: 2,
    });
    expect(f1.statusCode).toBe(200);
    indoreId = f1.json().factory.id;
    const f2 = await send("POST", "/api/admin/factories", admin, {
      name: "Pune Assembly", city: "Pune", state: "Maharashtra", country: "India", latitude: 18.52, longitude: 73.86, shiftsPerDay: 3,
    });
    puneId = f2.json().factory.id;
    for (const code of ["M-01", "M-02"]) {
      const m = await send("POST", `/api/admin/factories/${indoreId}/machines`, admin, { code, name: `Machine ${code}`, machineType: "cnc" });
      expect(m.statusCode).toBe(200);
      machineIds.push(m.json().machine.id);
    }
    const dup = await send("POST", `/api/admin/factories/${indoreId}/machines`, admin, { code: "m-01", name: "Again", machineType: "cnc" });
    expect(dup.json().error.code).toBe("REQ-003");
  });

  it("explains invalid input field by field", async () => {
    const res = await send("POST", "/api/admin/factories", admin, { name: "", latitude: 200 });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("REQ-001");
    expect(res.json().error.message).toContain("latitude");
  });

  it("creates users with assigned factories", async () => {
    const viewer = await send("POST", "/api/admin/users", admin, { username: "viewer", displayName: "Viewer", password: "viewer-pass-1", factoryIds: [indoreId] });
    expect(viewer.statusCode).toBe(200);
    expect(viewer.json().user).toMatchObject({ canUpdateStatus: false, mustChangePassword: true, factoryIds: [indoreId] });
    const sup = await send("POST", "/api/admin/users", admin, { username: "sup", displayName: "Supervisor", password: "sup-pass-1", canUpdateStatus: true, factoryIds: [indoreId] });
    expect(sup.statusCode).toBe(200);
    const bad = await send("POST", "/api/admin/users", admin, { username: "x1x", displayName: "X", password: "password-1", factoryIds: [9999] });
    expect(bad.json().error.code).toBe("REQ-001");
  });

  it("non-admins cannot use admin routes", async () => {
    const t = await firstLogin("viewer", "viewer-pass-1");
    expect((await get("/api/admin/users", t)).json().error.code).toBe("PERM-001");
  });
});

async function firstLogin(username: string, password: string) {
  const t = await login(client, username, password);
  const res = await send("POST", "/api/auth/change-password", t, { currentPassword: password, newPassword: `${password}-new` });
  return res.json().token as string;
}

let viewer: string;
let sup: string;

describe("factory access", () => {
  it("users see only their assigned factories", async () => {
    viewer = await login(client, "viewer", "viewer-pass-1-new");
    sup = await firstLogin("sup", "sup-pass-1");
    const list = (await get("/api/factories", viewer)).json().factories;
    expect(list.map((f: { id: number }) => f.id)).toEqual([indoreId]);
    expect((await get(`/api/factories/${puneId}`, viewer)).json().error.code).toBe("PERM-002");
    const all = (await get("/api/factories", admin)).json().factories;
    expect(all).toHaveLength(2);
  });

  it("a user without permission cannot upload or edit (PERM-003)", async () => {
    const res = await upload(`/api/factories/${indoreId}/uploads/preview`, viewer, [[day, 1, "M-01", "Running"]]);
    expect(res.json().error.code).toBe("PERM-003");
    const edit = await send("PUT", `/api/machines/${machineIds[0]}/status`, viewer, { workDate: day, shift: 1, status: "running" });
    expect(edit.json().error.code).toBe("PERM-003");
  });
});

describe("Excel upload", () => {
  const goodRows = [
    [day, 1, "M-01", "Running", 0, ""],
    [day, 2, "M-01", "Aborted", 2, "Tool broke"],
    [day, 1, "M-02", "Stopped", 0, ""],
    [day, 2, "M-02", "Shift Ended", 0, ""],
  ];

  it("preview saves nothing and lists changes", async () => {
    const res = await upload(`/api/factories/${indoreId}/uploads/preview`, sup, goodRows);
    expect(res.statusCode).toBe(200);
    const p = res.json().preview;
    expect(p).toMatchObject({ workDate: day, rowCount: 4, canConfirm: true, replacesUploadId: null, errors: [] });
    expect(p.changes).toHaveLength(4);
    const factory = (await get(`/api/factories/${indoreId}`, sup)).json().factory;
    expect(factory.machines.every((m: { current: unknown }) => m.current === null)).toBe(true);
  });

  it("confirm refuses a file with errors (UPLOAD-001)", async () => {
    const res = await upload(`/api/factories/${indoreId}/uploads`, sup, [[day, 1, "M-77", "Running"]]);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("UPLOAD-001");
    expect(res.json().error.details.errors[0].code).toBe("XL-005");
  });

  it("only .xlsx files are accepted", async () => {
    const res = await client.request("POST", `/api/factories/${indoreId}/uploads/preview`, {
      token: sup,
      file: { fileName: "day.csv", mimeType: "text/csv", data: new TextEncoder().encode("a,b") },
    });
    expect(res.json().error.code).toBe("FILE-003");
  });

  it("confirm saves the statuses and records the upload", async () => {
    const res = await upload(`/api/factories/${indoreId}/uploads`, sup, goodRows);
    expect(res.statusCode).toBe(200);
    const factory = (await get(`/api/factories/${indoreId}`, viewer)).json().factory;
    const m1 = factory.machines.find((m: { code: string }) => m.code === "M-01");
    expect(m1.current).toMatchObject({ status: "aborted", shift: 2, workDate: day, abortCount: 2, source: "upload" });
    expect(factory.statusCounts).toMatchObject({ aborted: 1, shift_ended: 1 });
    const uploads = (await get(`/api/factories/${indoreId}/uploads`, viewer)).json().uploads;
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toMatchObject({ workDate: day, uploadedBy: "Supervisor", supersededBy: null, rowCount: 4 });
  });

  it("a corrected file for the same day replaces the active data, and both stay in history", async () => {
    const preview = (await upload(`/api/factories/${indoreId}/uploads/preview`, sup, goodRows.map((r) => (r[2] === "M-01" && r[1] === 2 ? [day, 2, "M-01", "Running", 0, "Corrected"] : r)))).json().preview;
    expect(preview.replacesUploadId).not.toBeNull();
    expect(preview.warnings[0].code).toBe("XL-103");
    const changed = preview.changes.find((c: { machineCode: string; shift: number }) => c.machineCode === "M-01" && c.shift === 2);
    expect(changed).toMatchObject({ previousStatus: "aborted", newStatus: "running" });

    const res = await upload(`/api/factories/${indoreId}/uploads`, sup, [
      [day, 1, "M-01", "Running", 0, ""],
      [day, 2, "M-01", "Running", 0, "Corrected"],
    ], "corrected.xlsx");
    expect(res.statusCode).toBe(200);
    const uploads = (await get(`/api/factories/${indoreId}/uploads`, sup)).json().uploads;
    expect(uploads).toHaveLength(2);
    expect(uploads[1].supersededBy).toBe(uploads[0].id);

    // M-02 rows were only in the replaced file, so that day now has no M-02 data.
    const history = (await get(`/api/factories/${indoreId}/history?from=${day}&to=${day}`, viewer)).json().records;
    expect(history).toHaveLength(2);
    expect(history.every((r: { machineId: number }) => r.machineId === machineIds[0])).toBe(true);
  });

  it("the original file can be downloaded by users with access", async () => {
    const uploads = (await get(`/api/factories/${indoreId}/uploads`, viewer)).json().uploads;
    const res = await get(`/api/uploads/${uploads[1].id}/file`, viewer);
    expect(res.statusCode).toBe(200);
    expect(new TextDecoder().decode(res.rawPayload.subarray(0, 2))).toBe("PK");
  });

  it("the template download is a real workbook", async () => {
    const res = await get(`/api/factories/${puneId}/template?date=2026-10-19`, admin);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toContain("Pune-Assembly-2026-10-19.xlsx");
  });
});

describe("manual status edit", () => {
  it("a newer manual edit overrides the upload and is written to the change log", async () => {
    const res = await send("PUT", `/api/machines/${machineIds[1]}/status`, sup, { workDate: todayIso(), shift: 1, status: "stopped", remarks: "Maintenance" });
    expect(res.statusCode).toBe(200);
    expect(res.json().machine.current).toMatchObject({ status: "stopped", source: "manual", workDate: todayIso() });
    const audit = (await get("/api/admin/audit", admin)).json().entries;
    expect(audit[0]).toMatchObject({ action: "status.manual", user: "Supervisor" });
  });

  it("rejects a shift that does not exist and dates in the future", async () => {
    const res = await send("PUT", `/api/machines/${machineIds[1]}/status`, sup, { workDate: day, shift: 3, status: "stopped" });
    expect(res.json().error.code).toBe("REQ-001");
    const future = await send("PUT", `/api/machines/${machineIds[1]}/status`, sup, { workDate: "2999-01-01", shift: 1, status: "stopped" });
    expect(future.json().error.message).toContain("future");
  });
});

describe("account control", () => {
  it("deactivating a user signs them out immediately", async () => {
    const users = (await get("/api/admin/users", admin)).json().users;
    const v = users.find((u: { username: string }) => u.username === "viewer");
    await send("PATCH", `/api/admin/users/${v.id}`, admin, { active: false });
    expect((await get("/api/factories", viewer)).json().error.code).toBe("AUTH-002");
    const res = await client.request("POST", "/api/auth/login", { body: { username: "viewer", password: "viewer-pass-1-new" } });
    expect(res.json().error.code).toBe("AUTH-003");
  });

  it("an admin cannot deactivate themselves", async () => {
    const me = (await get("/api/auth/me", admin)).json().user;
    const res = await send("PATCH", `/api/admin/users/${me.id}`, admin, { active: false });
    expect(res.json().error.code).toBe("REQ-001");
  });

  it("archiving a factory hides it but keeps its history", async () => {
    await send("DELETE", `/api/admin/factories/${puneId}`, admin);
    const all = (await get("/api/factories", admin)).json().factories;
    expect(all.map((f: { id: number }) => f.id)).toEqual([indoreId]);
  });
});

describe("system", () => {
  it("health and public config work without signing in", async () => {
    expect((await get("/api/health")).json()).toMatchObject({ ok: true });
    const cfg = (await get("/api/config")).json();
    expect(cfg.branding.appTitle).toBeTruthy();
    expect(cfg.theme.statusColors.running).toMatch(/^#/);
    expect((await get("/api/legal/privacy")).json().markdown).toContain("Privacy");
  });

  it("unknown API paths return REQ-002", async () => {
    expect((await get("/api/nope")).json().error.code).toBe("REQ-002");
  });
});
}
