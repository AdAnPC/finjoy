import fs from "node:fs/promises";
import path from "node:path";

export interface DeviceProtectionConfig {
  frpAccountIds: string[];
  organizationName: string;
}

const CONFIG_FILE_PATH = path.resolve(
  process.cwd(),
  ".local-protection-config.json",
);

function parseEnvFrpAccounts(): string[] {
  const raw = process.env.FRP_GOOGLE_ACCOUNT_IDS ?? "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function getProtectionConfig(): Promise<DeviceProtectionConfig> {
  try {
    const raw = await fs.readFile(CONFIG_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<DeviceProtectionConfig>;
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
  } catch {
    return {
      frpAccountIds: parseEnvFrpAccounts(),
      organizationName: "FinJoy Crédito Móvil",
    };
  }
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
  await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}
