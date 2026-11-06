const { spawn } = require("node:child_process");
const path = require("node:path");

const appRoot = path.resolve(__dirname, "..");
const env = { ...process.env };

const port = env.PORT || "8081";
const child = spawn(
  "pnpm",
  ["exec", "expo", "start", "--localhost", "--port", port],
  {
    cwd: appRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

child.on("error", (error) => {
  console.error(`No se pudo iniciar Expo: ${error.message}`);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
