// Builds the small boundary files the globe draws (web/public/geo/*.json)
// from Natural Earth source GeoJSON.
//
// Usage: node scripts/build-geo.mjs <folder-with-natural-earth-geojson>
// Needs: ne_50m_admin_0_countries.geojson, ne_10m_admin_1_states_provinces.geojson
// Download from https://github.com/nvkelso/natural-earth-vector/tree/master/geojson
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const src = process.argv[2];
if (!src) {
  console.error("Usage: node scripts/build-geo.mjs <folder-with-natural-earth-geojson>");
  process.exit(1);
}
const out = path.resolve("web/public/geo");
mkdirSync(out, { recursive: true });
const mapshaper = path.resolve("node_modules/.bin/mapshaper");

function run(args) {
  execFileSync(mapshaper, args, { stdio: "inherit" });
}

run([
  path.join(src, "ne_50m_admin_0_countries.geojson"),
  "-filter-fields", "NAME,ISO_A2_EH",
  "-rename-fields", "name=NAME,iso=ISO_A2_EH",
  "-simplify", "20%", "keep-shapes",
  "-o", path.join(out, "countries.json"), "format=geojson", "precision=0.001",
]);

run([
  path.join(src, "ne_10m_admin_1_states_provinces.geojson"),
  "-filter-fields", "name,iso_a2,admin",
  "-rename-fields", "country=admin,iso=iso_a2",
  "-simplify", "3%", "keep-shapes",
  "-o", path.join(out, "states.json"), "format=geojson", "precision=0.001",
]);

// One small file per country (by ISO code), so the globe loads only the states of the country it flies to.
const all = JSON.parse(readFileSync(path.join(out, "states.json"), "utf8"));
const byCountry = {};
for (const f of all.features) {
  const iso = /^[A-Z]{2}$/.test(f.properties.iso ?? "") ? f.properties.iso : "XX";
  (byCountry[iso] ??= []).push(f);
}
rmSync(path.join(out, "states"), { recursive: true, force: true });
mkdirSync(path.join(out, "states"));
for (const [iso, features] of Object.entries(byCountry)) {
  writeFileSync(path.join(out, "states", `${iso}.json`), JSON.stringify({ type: "FeatureCollection", features }));
}
rmSync(path.join(out, "states.json"));
console.log("countries.json", Math.round(statSync(path.join(out, "countries.json")).size / 1024), "KB");
console.log(`states: ${Object.keys(byCountry).length} files in geo/states/`);
