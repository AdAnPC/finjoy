const fs = require("node:fs");
const path = require("node:path");

const userAgent = process.env.npm_config_user_agent ?? "";
if (!userAgent.startsWith("pnpm/")) {
  console.error("Este workspace requiere pnpm. Usa el comando pnpm indicado en README.md.");
  process.exit(1);
}

for (const lockFile of ["package-lock.json", "yarn.lock"]) {
  fs.rmSync(path.join(__dirname, "..", lockFile), { force: true });
}
