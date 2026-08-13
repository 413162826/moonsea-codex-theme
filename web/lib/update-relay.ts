const RELEASE_REPOSITORY = "413162826/moonsea-codex-theme";

export type UpdateClient = "codex" | "workbuddy";
export type UpdatePlatform = "windows" | "macos";
export type UpdatePackageKind = "installer" | "archive";

const CLIENT_ASSET_PREFIX: Record<UpdateClient, string> = {
  codex: "Moonsea-Codex",
  workbuddy: "Moonsea-WorkBuddy",
};

export function parseUpdateClient(value: string | null): UpdateClient | null {
  return value === "codex" || value === "workbuddy" ? value : null;
}

export function parseUpdatePlatform(value: string | null): UpdatePlatform | null {
  return value === "windows" || value === "macos" ? value : null;
}

export function parseUpdatePackageKind(value: string | null): UpdatePackageKind | null {
  return value === "installer" || value === "archive" ? value : null;
}

export function isValidUpdateVersion(value: string | null): value is string {
  return typeof value === "string" && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
}

export function upstreamUpdateManifestUrl(client: UpdateClient) {
  const fileName = client === "codex" ? "update.json" : "update-workbuddy.json";
  return `https://github.com/${RELEASE_REPOSITORY}/releases/latest/download/${fileName}`;
}

export function updateAssetName(
  client: UpdateClient,
  platform: UpdatePlatform,
  kind: UpdatePackageKind,
) {
  const prefix = CLIENT_ASSET_PREFIX[client];
  if (platform === "macos") {
    if (kind !== "archive") return null;
    return `${prefix}-macOS.zip`;
  }
  if (kind === "installer") return `${prefix}-Windows-x64-Setup.exe`;
  return `${prefix}-Windows-x64.zip`;
}

export function upstreamUpdatePackageUrl(
  client: UpdateClient,
  version: string,
  platform: UpdatePlatform,
  kind: UpdatePackageKind,
) {
  const assetName = updateAssetName(client, platform, kind);
  if (!assetName || !isValidUpdateVersion(version)) return null;
  return `https://github.com/${RELEASE_REPOSITORY}/releases/download/v${version}/${assetName}`;
}

export function rewriteUpdateManifest(
  manifest: Record<string, unknown>,
  client: UpdateClient,
  origin: string,
) {
  const version = typeof manifest.version === "string" ? manifest.version : null;
  if (!isValidUpdateVersion(version)) {
    throw new Error("更新清单版本号无效");
  }
  const platforms = manifest.platforms;
  if (!platforms || typeof platforms !== "object") throw new Error("更新清单缺少平台信息");
  const rewritten = structuredClone(manifest) as Record<string, unknown>;
  const rewrittenPlatforms = rewritten.platforms as Record<string, Record<string, unknown>>;
  const windows = rewrittenPlatforms.windows;
  if (windows && typeof windows === "object") {
    const installer = windows.installer as Record<string, unknown> | undefined;
    if (installer && typeof installer === "object") {
      installer.url = `${origin}/api/updates/package?client=${client}&platform=windows&kind=installer&version=${encodeURIComponent(version)}`;
    }
    windows.url = `${origin}/api/updates/package?client=${client}&platform=windows&kind=archive&version=${encodeURIComponent(version)}`;
  }
  const macos = rewrittenPlatforms.macos;
  if (macos && typeof macos === "object") {
    macos.url = `${origin}/api/updates/package?client=${client}&platform=macos&kind=archive&version=${encodeURIComponent(version)}`;
  }
  return rewritten;
}

export const UPDATE_RELAY_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";
export const UPDATE_PACKAGE_CACHE_CONTROL = "public, max-age=86400, immutable";
