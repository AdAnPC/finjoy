const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const replitDomain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
const candidateUrl =
  configuredUrl || (replitDomain ? `https://${replitDomain}` : "");

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
