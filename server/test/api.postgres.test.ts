import { describe } from "vitest";
import { runApiSuite } from "./api-suite.js";

describe("API on postgres", () => runApiSuite("postgres"));
