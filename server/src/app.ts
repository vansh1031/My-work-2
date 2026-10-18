// Builds the web server: plugins, the sign-in check that runs before every request, routes, and error handling.
// Tests call buildApp directly; index.ts calls it and then starts listening.
import { existsSync } from "node:fs";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import type { AppContext } from "./context.js";
import { AppError, ERROR_CATALOG } from "./errors.js";
import { loadUser } from "./auth/guard.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { factoryRoutes } from "./routes/factories.js";
import { systemRoutes } from "./routes/system.js";
import { uploadRoutes } from "./routes/uploads.js";

export async function buildApp(ctx: AppContext, opts: { logger?: boolean | object } = {}) {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 1024 * 1024 });

  await app.register(cors, {
    origin: ctx.env.corsOrigins.includes("*") ? true : ctx.env.corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { files: 1 } });

  app.decorateRequest("user", null);
  app.decorateRequest("sessionToken", null);
  app.addHook("onRequest", async (req) => {
    if (req.url.startsWith("/api/")) await loadUser(req, ctx.db, ctx.config.app.sessionIdleMinutes);
  });
  app.addHook("onSend", async (_req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
  });

  app.setErrorHandler((err: unknown, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    const e = err as { statusCode?: number; code?: string; message?: string };
    if (e.statusCode === 429) {
      return reply.status(429).send({ error: { code: "REQ-004", message: ERROR_CATALOG["REQ-004"].message } });
    }
    if (e.code === "FST_REQ_FILE_TOO_LARGE") {
      return reply.status(413).send({ error: { code: "FILE-002", message: ERROR_CATALOG["FILE-002"].message } });
    }
    if (e.code === "FST_INVALID_MULTIPART_CONTENT_TYPE") {
      return reply.status(400).send({ error: { code: "FILE-001", message: ERROR_CATALOG["FILE-001"].message } });
    }
    if (e.statusCode && e.statusCode >= 400 && e.statusCode < 500) {
      return reply.status(e.statusCode).send({ error: { code: "REQ-001", message: e.message ?? "Bad request." } });
    }
    req.log.error({ err }, "unhandled error");
    return reply.status(500).send({ error: { code: "SERVER-001", message: ERROR_CATALOG["SERVER-001"].message } });
  });

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api/") || !existsSync(ctx.env.webDistDir)) {
      return reply.status(404).send({ error: { code: "REQ-002", message: "Not found." } });
    }
    // Any other path is a screen of the web app; let the app's router handle it.
    return reply.sendFile("index.html");
  });

  await systemRoutes(app, ctx);
  await authRoutes(app, ctx);
  await factoryRoutes(app, ctx);
  await uploadRoutes(app, ctx);
  await adminRoutes(app, ctx);

  // The same server also serves the web version of the app (useful for TV screens and browsers).
  if (existsSync(ctx.env.webDistDir)) {
    await app.register(fastifyStatic, { root: ctx.env.webDistDir, wildcard: false });
  }

  return app;
}
