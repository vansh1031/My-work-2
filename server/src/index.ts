// Entry point of the server. Order: read env -> load and check config -> connect and migrate database
// -> optional sample data -> build routes -> listen. docs/flow.md walks through this in detail.
import { readEnv } from "./env.js";
import { bootstrap } from "./bootstrap.js";
import { buildApp } from "./app.js";
import { seedSampleData } from "./scripts/sample-data.js";

async function main() {
  const env = readEnv();
  const ctx = await bootstrap(env);
  if (env.seedSampleData) {
    const created = await seedSampleData(ctx.db);
    if (created) console.log("Sample factories and machines were added (SEED_SAMPLE_DATA=true).");
  }
  const app = await buildApp(ctx, {
    logger: { level: env.logLevel, redact: ["req.headers.authorization"] },
  });
  await app.listen({ port: env.port, host: env.host });
  console.log(`Factory Atlas server ${ctx.version} is running on port ${env.port}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
