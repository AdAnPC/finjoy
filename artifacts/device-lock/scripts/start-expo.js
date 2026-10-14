const { spawn } = require("node:child_process");
const path = require("node:path");

const appRoot = path.resolve(__dirname, "..");
const env = { ...process.env };

if (env.REPLIT_EXPO_DEV_DOMAIN) {
  env.EXPO_PACKAGER_PROXY_URL = `https://${env.REPLIT_EXPO_DEV_DOMAIN}`;
  env.REACT_NATIVE_PACKAGER_HOSTNAME =
    env.REPLIT_DEV_DOMAIN || env.REACT_NATIVE_PACKAGER_HOSTNAME;
}
if (env.REPLIT_DEV_DOMAIN) {
  env.EXPO_PUBLIC_DOMAIN = env.REPLIT_DEV_DOMAIN;
}
if (env.REPL_ID) {
  env.EXPO_PUBLIC_REPL_ID = env.REPL_ID;
}

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
