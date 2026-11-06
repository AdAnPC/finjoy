const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..");
const port =
  process.env.PORT ||
  process.env.FINJOY_ADMIN_PORT ||
  process.env.FINJOY_API_PORT ||
  "5173";

if (!process.env.DATABASE_URL) {
  console.error(
    "Falta DATABASE_URL. Copia .env.example a .env y configura una base PostgreSQL.",
  );
  process.exit(1);
}

const apiDist = path.resolve(
  workspaceRoot,
  "artifacts/api-server/dist/index.mjs",
);
const apiSrc = path.resolve(workspaceRoot, "artifacts/api-server/src");
const webDistIndex = path.resolve(
  workspaceRoot,
  "artifacts/admin-panel/dist/public/index.html",
);
const webSrc = path.resolve(workspaceRoot, "artifacts/admin-panel/src");
const viteBin = path.resolve(workspaceRoot, "node_modules/vite/bin/vite.js");
const viteConfig = path.resolve(
  workspaceRoot,
  "artifacts/admin-panel/vite.config.ts",
);

const forceRebuild =
  process.argv.includes("--rebuild") || process.argv.includes("-b");

function hasNewerSourceFile(dir, targetMtime) {
  if (!fs.existsSync(dir)) return false;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (hasNewerSourceFile(full, targetMtime)) return true;
    } else if (
      entry.isFile() &&
      /\.(ts|tsx|js|jsx|css|html|json)$/.test(full)
    ) {
      if (fs.statSync(full).mtimeMs > targetMtime) return true;
    }
  }
  return false;
}

function isWebRebuildNeeded() {
  if (forceRebuild || !fs.existsSync(webDistIndex)) return true;
  try {
    const distMtime = fs.statSync(webDistIndex).mtimeMs;
    return (
      hasNewerSourceFile(webSrc, distMtime) ||
      hasNewerSourceFile(
        path.resolve(workspaceRoot, "lib/api-client-react/src"),
        distMtime,
      )
    );
  } catch {
    return false;
  }
}

function isApiRebuildNeeded() {
  if (forceRebuild || !fs.existsSync(apiDist)) return true;
  try {
    const distMtime = fs.statSync(apiDist).mtimeMs;
    return (
      hasNewerSourceFile(apiSrc, distMtime) ||
      hasNewerSourceFile(path.resolve(workspaceRoot, "lib"), distMtime)
    );
  } catch {
    return false;
  }
}

if (isWebRebuildNeeded()) {
  console.log("Compilando Panel Web (admin-panel)...");
  try {
    execFileSync(
      process.execPath,
      [viteBin, "build", "--config", viteConfig],
      {
        cwd: path.resolve(workspaceRoot, "artifacts/admin-panel"),
        env: {
          ...process.env,
          BASE_PATH: "/",
          PORT: port,
        },
        stdio: "inherit",
      },
    );
  } catch (err) {
    console.error("Error al compilar el Panel Web:", err.message);
    process.exit(1);
  }
}

if (isApiRebuildNeeded()) {
  console.log("Compilando Servidor Unificado (api-server)...");
  try {
    execFileSync(
      process.execPath,
      [path.resolve(workspaceRoot, "artifacts/api-server/build.mjs")],
      {
        cwd: workspaceRoot,
        stdio: "inherit",
      },
    );
  } catch (err) {
    console.error("Error al compilar el servidor:", err.message);
    process.exit(1);
  }
}

console.log(`\n========================================`);
console.log(`🚀 FinJoy Web + API (Un solo arranque)`);
console.log(`  ➜ Web y Panel: http://localhost:${port}/`);
console.log(`  ➜ Health API:  http://localhost:${port}/api/healthz`);
console.log(`========================================\n`);

const child = spawn(
  process.execPath,
  ["--enable-source-maps", apiDist],
  {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || "development",
      PORT: port,
    },
    stdio: "inherit",
  },
);

function stopServer(exitCode = 0) {
  if (!child.killed) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", child.pid.toString(), "/f", "/t"]);
      } else {
        child.kill("SIGTERM");
      }
    } catch {}
  }
  setTimeout(() => process.exit(exitCode), 200);
}

process.on("SIGINT", () => stopServer(0));
process.on("SIGTERM", () => stopServer(0));

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
