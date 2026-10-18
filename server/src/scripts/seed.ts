// Run with: npm run seed -w server
// Adds the sample data to an empty database without starting the server.
import { readEnv } from "../env.js";
import { bootstrap } from "../bootstrap.js";
import { seedSampleData } from "./sample-data.js";

const ctx = await bootstrap(readEnv());
console.log((await seedSampleData(ctx.db)) ? "Sample data added." : "The database already has factories. Nothing was added.");
await ctx.db.end();
