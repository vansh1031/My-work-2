// Routes that work without signing in: health check, status page data, public config, legal pages and files.
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../context.js";
import { publicConfig } from "../config/load.js";
import { AppError } from "../errors.js";
import { CONTENT_TYPES, FILE_NAME_PATTERN, filesDir } from "../services/files.js";

export async function systemRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/api/health", async (_req, reply) => {
    try {
      await ctx.db.query("SELECT 1");
      return { ok: true, version: ctx.version };
    } catch {
      return reply.status(503).send({ ok: false, version: ctx.version, error: { code: "DB-001", message: "The database is not reachable." } });
    }
  });

  app.get("/api/status", async () => {
    let database = "ok";
    let migrations: string[] = [];
    try {
      migrations = (await ctx.db.query<{ name: string }>("SELECT name FROM schema_migrations ORDER BY name")).rows.map((r) => r.name);
    } catch (err) {
      database = `error: ${(err as Error).message}`;
    }
    return {
      version: ctx.version,
      serverTime: new Date().toISOString(),
      database,
      migrations,
      config: "ok",
      features: ctx.config.app.features,
      debug: ctx.config.app.debug,
    };
  });

  app.get("/api/config", async () => publicConfig(ctx.config));

  app.get<{ Params: { page: string } }>("/api/legal/:page", async (req) => {
    if (req.params.page === "privacy") return { markdown: ctx.config.legal.privacyPolicy };
    if (req.params.page === "terms") return { markdown: ctx.config.legal.terms };
    throw new AppError("REQ-002");
  });

  // Logo and favicon from the config folder. Only those two files are served.
  app.get<{ Params: { which: string } }>("/api/brand/:which", async (req, reply) => {
    const which = req.params.which;
    if (which !== "logo" && which !== "favicon") throw new AppError("REQ-002");
    const file = path.join(ctx.config.dir, ctx.config.branding[which]);
    const ext = path.extname(file).toLowerCase();
    const type = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon" }[ext];
    if (!type || !existsSync(file)) throw new AppError("REQ-002");
    return reply.header("Content-Type", type).header("Cache-Control", "no-cache").send(createReadStream(file));
  });

  app.get<{ Params: { name: string } }>("/api/files/:name", async (req, reply) => {
    const name = req.params.name;
    if (!FILE_NAME_PATTERN.test(name)) throw new AppError("REQ-002");
    const full = path.join(filesDir(ctx.env.dataDir), name);
    if (!existsSync(full)) throw new AppError("REQ-002");
    return reply
      .header("Content-Type", CONTENT_TYPES[path.extname(name)] ?? "application/octet-stream")
      .header("Cache-Control", "private, max-age=86400, immutable")
      .send(createReadStream(full));
  });
}
