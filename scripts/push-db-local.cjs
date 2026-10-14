const { spawnSync } = require("node:child_process");

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL. Configura una base PostgreSQL local en .env.");
  process.exit(1);
}

let databaseHost;
try {
  databaseHost = new URL(process.env.DATABASE_URL).hostname.toLowerCase();
} catch {
  console.error("DATABASE_URL no tiene un formato PostgreSQL válido.");
  process.exit(1);
}

const localHosts = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "host.docker.internal",
]);
if (!localHosts.has(databaseHost)) {
  console.error(
    `Rechazado: el host "${databaseHost}" no parece local. Este comando solo modifica PostgreSQL local; no lo uses con producción.`,
  );
  process.exit(1);
}

const result = spawnSync(
  "npx",
  [
    "--yes",
    "pnpm@10.26.1",
    "--filter",
    "@workspace/db",
    "run",
    "push",
  ],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
