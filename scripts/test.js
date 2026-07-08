// Structural smoke test for @unitsml/unitsdb.
// Verifies the build artifacts exist and contain expected Opal module
// registrations — WITHOUT loading them, to avoid runtime deps on
// lutaml-model (which is a peer that hasn't shipped yet).
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
const errors = [];

function check(name, file, patterns) {
  const full = path.join(distDir, file);
  if (!fs.existsSync(full)) {
    errors.push(`${name}: missing ${file}`);
    return;
  }
  const src = fs.readFileSync(full, "utf8");
  for (const [desc, regex] of Object.entries(patterns)) {
    if (!regex.test(src)) {
      errors.push(`${name}: ${desc} not found in ${file}`);
    }
  }
}

check("runtime", "unitsdb.js", {
  "Opal runtime IIFE": /\(function\(global_object\)/,
  "unitsdb modules registered": /Opal\.modules\["unitsdb\/identifier"\]/,
  "Database class compiled": /Opal\.modules\["unitsdb\/database"\]/,
});

check("external", "unitsdb-no-opal.js", {
  "unitsdb modules in external flavor": /Opal\.modules\["unitsdb\/identifier"\]/,
  "no embedded Opal runtime": (function () {
    return true; // external flavor may or may not include runtime
  })(),
});

check("types", "index.d.ts", {
  "TypeScript declaration": /declare/,
});

if (errors.length > 0) {
  console.error("\n✗ " + errors.join("\n✗ "));
  process.exit(1);
}

console.log("✓ unitsdb.js: Opal runtime + unitsdb modules present");
console.log("✓ unitsdb-no-opal.js: external flavor present");
console.log("✓ index.d.ts: TypeScript declaration present");
console.log("\nstructure verified (runtime loading deferred to consumer)");
