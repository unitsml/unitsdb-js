const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
const errors = [];

function check(file, patterns) {
  const full = path.join(distDir, file);
  if (!fs.existsSync(full)) { errors.push(`missing ${file}`); return; }
  const src = fs.readFileSync(full, "utf8");
  for (const [desc, re] of Object.entries(patterns)) {
    if (!re.test(src)) errors.push(`${desc} not in ${file}`);
  }
}

check("unitsdb.js", {
  "Opal runtime": /\(function\(global_object\)/,
  "unitsdb/identifier module": /Opal\.modules\["unitsdb\/identifier"\]/,
  "unitsdb/database module": /Opal\.modules\["unitsdb\/database"\]/,
});

check("unitsdb-no-opal.js", {
  "external has unitsdb modules": /Opal\.modules\["unitsdb\/identifier"\]/,
});

check("index.d.ts", {
  "TypeScript declaration": /declare/,
});

if (errors.length) { console.error("✗ " + errors.join("\n✗ ")); process.exit(1); }
console.log("✓ structure verified");
