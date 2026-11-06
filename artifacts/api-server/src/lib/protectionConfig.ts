import fs from "node:fs/promises";
import path from "node:path";
import { getLocalApkUploadDir } from "./apkStorage";

export interface DeviceProtectionConfig {
  frpAccountIds: string[];
  organizationName: string;
}

const LEGACY_CONFIG_FILE_PATH = path.resolve(
  process.cwd(),
  ".local-protection-config.json",
);

function getVolumeConfigFilePath(): string {
  return path.join(getLocalApkUploadDir(), "protection-config.json");
}

function parseEnvFrpAccounts(): string[] {
  const raw = process.env.FRP_GOOGLE_ACCOUNT_IDS ?? "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readConfigFromFile(
  filePath: string,
): Promise<Partial<DeviceProtectionConfig> | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as Partial<DeviceProtectionConfig>;
  } catch {
    return null;
  }
}

export async function getProtectionConfig(): Promise<DeviceProtectionConfig> {
  const parsed =
    (await readConfigFromFile(getVolumeConfigFilePath())) ??
    (await readConfigFromFile(LEGACY_CONFIG_FILE_PATH));

  if (parsed) {
    const frpAccountIds = Array.isArray(parsed.frpAccountIds)
      ? parsed.frpAccountIds
          .map((item) => String(item).trim())
          .filter(Boolean)
      : parseEnvFrpAccounts();
    return {
      frpAccountIds,
      organizationName:
        typeof parsed.organizationName === "string" &&
        parsed.organizationName.trim()
          ? parsed.organizationName.trim()
          : "FinJoy Crédito Móvil",
    };
  }

  return {
    frpAccountIds: parseEnvFrpAccounts(),
    organizationName: "FinJoy Crédito Móvil",
  };
}

export async function saveProtectionConfig(
  input: Partial<DeviceProtectionConfig>,
): Promise<DeviceProtectionConfig> {
  const current = await getProtectionConfig();
  const next: DeviceProtectionConfig = {
    frpAccountIds: Array.isArray(input.frpAccountIds)
      ? input.frpAccountIds
          .map((item) => String(item).trim())
          .filter(Boolean)
      : current.frpAccountIds,
    organizationName:
      typeof input.organizationName === "string" &&
      input.organizationName.trim()
        ? input.organizationName.trim()
        : current.organizationName,
  };
  const serialized = JSON.stringify(next, null, 2);
  await fs.writeFile(getVolumeConfigFilePath(), serialized, "utf8");
  await fs.writeFile(LEGACY_CONFIG_FILE_PATH, serialized, "utf8").catch(() => {});
  return next;
}
