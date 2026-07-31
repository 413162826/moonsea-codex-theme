const AUTHENTICATED_EMAIL_HEADER = "oai-authenticated-user-email";
const BEARER_TOKEN = /^Bearer ([^\s]+)$/i;

export type ThemeUploadAuthConfig = {
  allowedEmails?: string;
  uploadToken?: string;
};

function hasAllowedPlatformEmail(
  request: Request,
  allowedEmails: string | undefined,
) {
  const email = request.headers
    .get(AUTHENTICATED_EMAIL_HEADER)
    ?.trim()
    .toLowerCase();
  if (!email) return false;

  return String(allowedEmails ?? "")
    .split(",")
    .some((item) => item.trim().toLowerCase() === email);
}

function getBearerToken(request: Request) {
  return request.headers.get("authorization")?.match(BEARER_TOKEN)?.[1] ?? null;
}

async function secretsEqual(candidate: string, expected: string) {
  const encoder = new TextEncoder();
  const [candidateDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const candidateBytes = new Uint8Array(candidateDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < candidateBytes.length; index += 1) {
    difference |= candidateBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

export async function isThemeUploadAuthorized(
  request: Request,
  config: ThemeUploadAuthConfig,
) {
  if (hasAllowedPlatformEmail(request, config.allowedEmails)) return true;

  const expectedToken = config.uploadToken?.trim();
  const candidateToken = getBearerToken(request);
  if (!expectedToken || !candidateToken) return false;

  return secretsEqual(candidateToken, expectedToken);
}
