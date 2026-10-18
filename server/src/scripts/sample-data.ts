// Sample factories, machines, users and 14 days of statuses, so a fresh install has something to show.
// Everything here is marked as sample (factories.is_sample = TRUE) and the app labels it "Sample data".
// Runs only when SEED_SAMPLE_DATA=true and the database has no factories yet.
import { randomBytes } from "node:crypto";
import type { Db } from "../db/pool.js";
import { withTransaction } from "../db/pool.js";
import { hashPassword } from "../auth/passwords.js";

const FACTORIES = [
  { name: "Indore Plant", city: "Indore", state: "Madhya Pradesh", country: "India", latitude: 22.7196, longitude: 75.8577 },
  { name: "Pithampur Works", city: "Pithampur", state: "Madhya Pradesh", country: "India", latitude: 22.6139, longitude: 75.6797 },
  { name: "Pune Assembly", city: "Pune", state: "Maharashtra", country: "India", latitude: 18.5204, longitude: 73.8567 },
  { name: "Chennai Components", city: "Chennai", state: "Tamil Nadu", country: "India", latitude: 13.0827, longitude: 80.2707 },
  { name: "Stuttgart Tooling", city: "Stuttgart", state: "Baden-Württemberg", country: "Germany", latitude: 48.7758, longitude: 9.1829 },
  { name: "Monterrey Plant", city: "Monterrey", state: "Nuevo León", country: "Mexico", latitude: 25.6866, longitude: -100.3161 },
];

const MACHINES = [
  { code: "M-01", name: "CNC Milling Centre", machineType: "cnc", description: "Vertical machining centre for milling and drilling steel and aluminium parts." },
  { code: "M-02", name: "Turning Lathe", machineType: "lathe", description: "CNC lathe for shafts, bushes and other round parts." },
  { code: "M-03", name: "Hydraulic Press", machineType: "press", description: "Press for forming and stamping sheet metal." },
  { code: "M-04", name: "Injection Moulding Machine", machineType: "injection", description: "Moulds plastic housings and covers." },
  { code: "M-05", name: "Welding Robot Cell", machineType: "robot", description: "Six-axis robot for spot and arc welding of frames." },
  { code: "M-06", name: "Packing Conveyor", machineType: "conveyor", description: "Conveyor line that moves finished parts to packing." },
];

/** Small predictable random generator, so the sample data is the same on every install. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function pickStatus(r: number): "running" | "stopped" | "aborted" | "shift_ended" {
  if (r < 0.68) return "running";
  if (r < 0.82) return "stopped";
  if (r < 0.92) return "aborted";
  return "shift_ended";
}

export async function seedSampleData(db: Db): Promise<boolean> {
  const existing = await db.query("SELECT 1 FROM factories LIMIT 1");
  if (existing.rowCount) return false;

  const samplePassword = await hashPassword("sample-pass-1");
  await withTransaction(db, async (client) => {
    const sampleUser = await client.query<{ id: number }>(
      `INSERT INTO users (username, display_name, password_hash, role, active, must_change_password)
       VALUES ('sample-data', 'Sample data', $1, 'user', FALSE, FALSE)
       ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username RETURNING id`,
      [await hashPassword(randomBytes(24).toString("hex"))],
    );
    const authorId = sampleUser.rows[0]!.id;

    const factoryIds: number[] = [];
    for (const f of FACTORIES) {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO factories (name, city, state, country, latitude, longitude, shifts_per_day, is_sample)
         VALUES ($1, $2, $3, $4, $5, $6, 2, TRUE) RETURNING id`,
        [f.name, f.city, f.state, f.country, f.latitude, f.longitude],
      );
      factoryIds.push(rows[0]!.id);
    }

    const rand = seeded(42);
    const today = new Date();
    for (const factoryId of factoryIds) {
      for (const m of MACHINES) {
        const { rows } = await client.query<{ id: number }>(
          `INSERT INTO machines (factory_id, code, name, machine_type, description) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [factoryId, m.code, m.name, m.machineType, m.description],
        );
        const machineId = rows[0]!.id;
        for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
          const d = new Date(today);
          d.setDate(d.getDate() - daysAgo);
          const workDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          for (const shift of [1, 2]) {
            const status = pickStatus(rand());
            const aborts = status === "aborted" ? 1 + Math.floor(rand() * 3) : 0;
            await client.query(
              `INSERT INTO status_records (machine_id, work_date, shift, status, abort_count, remarks, source, created_by)
               VALUES ($1, $2, $3, $4, $5, 'Sample data', 'manual', $6)`,
              [machineId, workDate, shift, status, aborts, authorId],
            );
          }
        }
      }
    }

    // Two sample accounts to try the permission switch: one can upload and edit, one can only view.
    const users = [
      { username: "supervisor", displayName: "Sample Supervisor", canUpdate: true, factories: factoryIds.slice(0, 4) },
      { username: "viewer", displayName: "Sample Viewer", canUpdate: false, factories: factoryIds.slice(0, 2) },
    ];
    for (const u of users) {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO users (username, display_name, password_hash, role, can_update_status, must_change_password)
         VALUES ($1, $2, $3, 'user', $4, FALSE) ON CONFLICT (username) DO NOTHING RETURNING id`,
        [u.username, u.displayName, samplePassword, u.canUpdate],
      );
      if (!rows[0]) continue;
      for (const f of u.factories) {
        await client.query("INSERT INTO user_factories (user_id, factory_id) VALUES ($1, $2)", [rows[0].id, f]);
      }
    }
  });
  return true;
}
