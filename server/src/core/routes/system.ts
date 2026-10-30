// Routes that work without signing in: health check, status page data, public config, legal pages and files.
import { publicConfig } from "../config/validate.js";
import { AppError } from "../errors.js";
import { BinaryResponse, type Route } from "../http.js";
import { CONTENT_TYPES, extensionOf, FILE_NAME_PATTERN } from "../services/files.js";

const BRAND_TYPES: Record<string, string> = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon" };

export const systemRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/health",
    async handler(_req, ctx) {
      try {
        await ctx.db.query("SELECT 1");
      } catch {
        throw new AppError("DB-001");
      }
      return { ok: true, version: ctx.version };
    },
  },
  {
    method: "GET",
    path: "/api/status",
    async handler(_req, ctx) {
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
        dataMode: ctx.config.app.dataMode,
        database,
        migrations,
        config: "ok",
        features: ctx.config.app.features,
        debug: ctx.config.app.debug,
      };
    },
  },
  {
    method: "GET",
    path: "/api/config",
    async handler(_req, ctx) {
      return publicConfig(ctx.config);
    },
  },
  {
    method: "GET",
    path: "/api/legal/:page",
    async handler(req, ctx) {
      if (req.params.page === "privacy") return { markdown: ctx.config.legal.privacyPolicy };
      if (req.params.page === "terms") return { markdown: ctx.config.legal.terms };
      throw new AppError("REQ-002");
    },
  },
  {
    // Logo and favicon from the config folder. Only those two files are served.
    method: "GET",
    path: "/api/brand/:which",
    async handler(req, ctx) {
      const which = req.params.which;
      if (which !== "logo" && which !== "favicon") throw new AppError("REQ-002");
      const file = ctx.config.branding[which];
      const type = BRAND_TYPES[extensionOf(file)];
      const data = type ? await ctx.readConfigAsset(file) : null;
      if (!type || !data) throw new AppError("REQ-002");
      return new BinaryResponse(data, type, undefined, "no-cache");
    },
  },
  {
    method: "GET",
    path: "/api/files/:name",
    async handler(req, ctx) {
      const name = req.params.name ?? "";
      if (!FILE_NAME_PATTERN.test(name)) throw new AppError("REQ-002");
      const data = await ctx.files.read(name);
      if (!data) throw new AppError("REQ-002");
      return new BinaryResponse(data, CONTENT_TYPES[extensionOf(name)] ?? "application/octet-stream", undefined, "private, max-age=86400, immutable");
    },
  },
];
