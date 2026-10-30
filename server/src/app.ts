// Server mode: serves the routes from core/router.ts over HTTP with Fastify, plus the built web app.
// Adds what only a real server needs: CORS, rate limiting, reading uploaded files from multipart requests.
// Tests call buildApp directly; index.ts calls it and then starts listening.
import { existsSync } from "node:fs";
import Fastify, { type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import type { SessionUser } from "@fa/shared";
import { AppError, ERROR_CATALOG } from "./core/errors.js";
import { BinaryResponse, type Route, type UploadedFile } from "./core/http.js";
import { tokenFromHeader, userForToken } from "./core/auth/guard.js";
import { allRoutes } from "./core/router.js";
import type { NodeContext } from "./node/bootstrap.js";

declare module "fastify" {
  interface FastifyRequest {
    user: SessionUser | null;
    sessionToken: string | null;
  }
}

async function readFile(req: FastifyRequest, route: Route, ctx: NodeContext): Promise<UploadedFile | null> {
  if (!route.fileLimitBytes || !req.isMultipart()) return null;
  const file = await req.file({ limits: { fileSize: route.fileLimitBytes(ctx), files: 1 } });
  if (!file) return null;
  const data = await file.toBuffer();
  return { fileName: file.filename, mimeType: file.mimetype, data, truncated: file.file.truncated };
}

export async function buildApp(ctx: NodeContext, opts: { logger?: boolean | object } = {}) {
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
    if (!req.url.startsWith("/api/")) return;
    req.sessionToken = tokenFromHeader(req.headers.authorization);
    req.user = await userForToken(ctx.db, req.sessionToken, ctx.config.app.sessionIdleMinutes);
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

  for (const route of allRoutes) {
    app.route({
      method: route.method,
      url: route.path,
      // The sign-in route's limit can be changed per installation with LOGIN_RATE_LIMIT_PER_MINUTE.
      config: route.rateLimitPerMinute ? { rateLimit: { max: ctx.env.loginRateLimitPerMinute || route.rateLimitPerMinute, timeWindow: "1 minute" } } : {},
      handler: async (req, reply) => {
        const file = await readFile(req, route, ctx);
        const result = await route.handler(
          {
            params: req.params as Record<string, string>,
            query: req.query as Record<string, string>,
            body: req.body ?? {},
            user: req.user,
            sessionToken: req.sessionToken,
            file,
          },
          ctx,
        );
        if (result instanceof BinaryResponse) {
          reply.header("Content-Type", result.contentType);
          if (result.cacheControl) reply.header("Cache-Control", result.cacheControl);
          if (result.downloadName) {
            reply.header("Content-Disposition", `attachment; filename="${result.downloadName.replace(/["\\\r\n]/g, "_")}"`);
          }
          return reply.send(Buffer.from(result.data.buffer, result.data.byteOffset, result.data.byteLength));
        }
        return result;
      },
    });
  }

  // The same server also serves the web version of the app (useful for TV screens and browsers).
  if (existsSync(ctx.env.webDistDir)) {
    await app.register(fastifyStatic, { root: ctx.env.webDistDir, wildcard: false });
  }

  return app;
}
