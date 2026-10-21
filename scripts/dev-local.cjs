const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
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

const apiDist = path.resolve(workspaceRoot, "artifacts/api-server/dist/index.mjs");
const apiSrc = path.resolve(workspaceRoot, "artifacts/api-server/src");
const viteBin = path.resolve(workspaceRoot, "node_modules/vite/bin/vite.js");
const viteConfig = path.resolve(workspaceRoot, "artifacts/admin-panel/vite.config.ts");

function isRebuildNeeded() {
  if (!fs.existsSync(apiDist)) return true;
  if (process.argv.includes("--rebuild") || process.argv.includes("-b")) return true;

  try {
    const distMtime = fs.statSync(apiDist).mtimeMs;
    function hasNewerFile(dir) {
      if (!fs.existsSync(dir)) return false;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (hasNewerFile(full)) return true;
        } else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".js") || full.endsWith(".json"))) {
          if (fs.statSync(full).mtimeMs > distMtime) return true;
        }
      }
      return false;
    }
    return hasNewerFile(apiSrc) || hasNewerFile(path.resolve(workspaceRoot, "lib"));
  } catch {
    return false;
  }
}

if (isRebuildNeeded()) {
  console.log("Compilando API server...");
  try {
    execFileSync(process.execPath, [path.resolve(workspaceRoot, "artifacts/api-server/build.mjs")], {
      cwd: workspaceRoot,
      stdio: "inherit",
    });
  } catch (err) {
    console.error("Error al compilar el API:", err.message);
    process.exit(1);
  }
}

function startProcess(label, command, args, cwd, env) {
  const child = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    stdio: "inherit",
  });
  processes.push({ label, child });

  child.on("error", (error) => {
    console.error(`[${label}] Error: ${error.message}`);
    stopAll(1);
  });

  child.on("exit", (code) => {
    if (!stopping && code !== 0) {
      console.error(`[${label}] finalizó con código ${code ?? "desconocido"}.`);
      stopAll(code || 1);
    }
  });
}

function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const { child } of processes) {
    if (!child.killed) {
      try {
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", child.pid.toString(), "/f", "/t"]);
        } else {
          child.kill("SIGTERM");
        }
      } catch {}
    }
  }
  setTimeout(() => process.exit(exitCode), 300);
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

console.log(`\n========================================`);
console.log(`🚀 FinJoy iniciado`);
console.log(`  ➜ Panel Web:  http://localhost:${adminPort}/`);
console.log(`  ➜ API Server: http://localhost:${apiPort}/api/healthz`);
console.log(`========================================\n`);

// 1. Iniciar API Server
startProcess(
  "API",
  process.execPath,
  ["--enable-source-maps", apiDist],
  workspaceRoot,
  {
    NODE_ENV: "development",
    PORT: apiPort,
  }
);

// 2. Iniciar Vite Admin Panel
startProcess(
  "Admin",
  process.execPath,
  [viteBin, "--config", viteConfig, "--host", "0.0.0.0"],
  path.resolve(workspaceRoot, "artifacts/admin-panel"),
  {
    NODE_ENV: "development",
    PORT: adminPort,
    BASE_PATH: "/",
    LOCAL_API_PROXY: "true",
    LOCAL_API_TARGET: `http://127.0.0.1:${apiPort}`,
  }
);
