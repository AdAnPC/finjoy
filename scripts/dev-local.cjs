const { spawn } = require("node:child_process");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..");
const apiPort = process.env.FINJOY_API_PORT || "8080";
const adminPort = process.env.FINJOY_ADMIN_PORT || "5173";
const processes = [];
let stopping = false;

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL. Copia .env.example a .env y configura una base PostgreSQL de desarrollo.");
  process.exit(1);
}

function start(label, filter, port, extraEnv = {}) {
  const child = spawn(
    "npx",
    [
      "--yes",
      "pnpm@10.26.1",
      "--filter",
      filter,
      "run",
      "dev",
    ],
    {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        NODE_ENV: "development",
        PORT: port,
        ...extraEnv,
      },
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  processes.push({ label, child });
  child.on("error", (error) => {
    console.error(`[${label}] ${error.message}`);
    stopAll(1);
  });
  child.on("exit", (code) => {
    if (!stopping && code !== 0) {
      console.error(`[${label}] terminó con código ${code ?? "desconocido"}.`);
      stopAll(code || 1);
    }
  });
}

function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const { child } of processes) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 500);
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

console.log(`API local: http://localhost:${apiPort}/api/healthz`);
console.log(`Panel local: http://localhost:${adminPort}/`);
console.log("El guardado/subida de APKs requiere App Storage de Replit hasta elegir y configurar otro proveedor.");

start("@workspace/api-server", "@workspace/api-server", apiPort);
start(
  "@workspace/admin-panel",
  "@workspace/admin-panel",
  adminPort,
  {
    BASE_PATH: "/",
    LOCAL_API_PROXY: "true",
    LOCAL_API_TARGET: `http://127.0.0.1:${apiPort}`,
  },
);
