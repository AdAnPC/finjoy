const DEFAULT_PRODUCTION_API_URL =
  "https://workspaceapi-server-production-d7bb.up.railway.app";

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const publicDomain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
const candidateUrl =
  configuredUrl ||
  (publicDomain ? `https://${publicDomain}` : DEFAULT_PRODUCTION_API_URL);

let normalizedBaseUrl: string | null = null;
if (candidateUrl) {
  try {
    const parsed = new URL(candidateUrl);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      normalizedBaseUrl = parsed.origin;
    }
  } catch {
    normalizedBaseUrl = null;
  }
}

export const API_BASE_URL = normalizedBaseUrl;
export const API_IS_CONFIGURED = Boolean(normalizedBaseUrl);
