const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "../..");
const appConfig = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "app.json"), "utf8"),
);
const apkVersion = appConfig.expo?.version ?? "1.0.0";

function fail(message) {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
    ...options,
  });
  if (result.error) {
    fail(`No se pudo iniciar "${command}": ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function getJavaHomeCandidates() {
  const home = os.homedir();
  if (process.platform === "win32") {
    return [
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Android", "Android Studio", "jbr"),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "Android Studio", "jbr"),
    ].filter(Boolean);
  }
  if (process.platform === "darwin") {
    return [
      "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
      path.join(home, "Applications/Android Studio.app/Contents/jbr/Contents/Home"),
    ];
  }
  return [
    path.join(home, "android-studio/jbr"),
    "/opt/android-studio/jbr",
    "/usr/lib/jvm/java-17-openjdk-amd64",
  ];
}

function configureJava() {
  if (!process.env.JAVA_HOME) {
    const javaHome = getJavaHomeCandidates().find((candidate) =>
      fs.existsSync(path.join(candidate, "bin", process.platform === "win32" ? "java.exe" : "java")),
    );
    if (javaHome) {
      process.env.JAVA_HOME = javaHome;
      process.env.PATH = `${path.join(javaHome, "bin")}${path.delimiter}${process.env.PATH ?? ""}`;
    }
  }

  const javaCommand = process.platform === "win32" ? "java.exe" : "java";
  const javaPath = process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, "bin", javaCommand)
    : javaCommand;
  const javaResult = spawnSync(javaPath, ["-version"], { encoding: "utf8" });
  if (javaResult.error || javaResult.status !== 0) {
    fail("No se encontro Java. Instala Android Studio y completa su configuracion inicial; incluye el JDK requerido.");
  }

  const output = `${javaResult.stderr ?? ""}\n${javaResult.stdout ?? ""}`;
  const match = output.match(/version "(?:1\.)?(\d+)/i) ?? output.match(/openjdk\s+(\d+)/i);
  const major = match ? Number(match[1]) : 0;
  if (major < 17) {
    fail(`Java ${major || "desconocido"} no es compatible. Usa JDK 17 o posterior.`);
  }
  console.log(`Java ${major} detectado.`);
}

function configureAndroidSdk() {
  const home = os.homedir();
  const candidates =
    process.platform === "win32"
      ? [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Android", "Sdk")]
      : process.platform === "darwin"
        ? [path.join(home, "Library/Android/sdk")]
        : [path.join(home, "Android/Sdk")];
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || candidates.find((candidate) => candidate && fs.existsSync(candidate));

  if (!sdk || !fs.existsSync(sdk)) {
    fail("No se encontro Android SDK. Instala Android Studio y Android SDK Platform 36; consulta BUILD_APK_LOCAL.md.");
  }
  if (!fs.existsSync(path.join(sdk, "platforms", "android-36", "android.jar"))) {
    fail(`Android SDK Platform 36 no esta instalada en "${sdk}". Instalala desde Android Studio > SDK Manager.`);
  }

  process.env.ANDROID_HOME = sdk;
  process.env.ANDROID_SDK_ROOT = sdk;
  console.log(`Android SDK: ${sdk}`);
}

console.log("FinJoy: preparando compilacion Android local...");
configureJava();
configureAndroidSdk();

console.log("\n[1/3] Instalando las dependencias del proyecto...");
run("npx", ["--yes", "pnpm@10.26.1", "install", "--frozen-lockfile"]);

const androidDir = path.join(projectRoot, "android");
if (!fs.existsSync(androidDir)) {
  console.log("\n[2/3] Generando el proyecto Android de Expo...");
  run("npx", [
    "--yes",
    "pnpm@10.26.1",
    "--filter",
    "@workspace/device-lock",
    "exec",
    "expo",
    "prebuild",
    "--platform",
    "android",
    "--no-install",
  ]);
} else {
  console.log("\n[2/3] Se reutilizara el proyecto Android local existente.");
}

const gradleWrapper = path.join(
  androidDir,
  process.platform === "win32" ? "gradlew.bat" : "gradlew",
);
if (!fs.existsSync(gradleWrapper)) {
  fail("Expo no genero el wrapper de Gradle. Elimina artifacts/device-lock/android y vuelve a ejecutar el asistente.");
}

console.log("\n[3/3] Compilando una APK debug instalable...");
run(gradleWrapper, ["assembleDebug"], { cwd: androidDir });

const builtApk = path.join(
  androidDir,
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk",
);
if (!fs.existsSync(builtApk)) {
  fail("Gradle termino, pero no se encontro app-debug.apk en la salida esperada.");
}

const outputDir = path.join(workspaceRoot, "generated-apk");
const outputApk = path.join(outputDir, "FinJoy-debug.apk");
fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(builtApk, outputApk);
console.log(`\nAPK lista: ${outputApk}`);
