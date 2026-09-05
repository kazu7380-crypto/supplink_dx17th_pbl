export const AUTH_COOKIE_NAME = "supplink_session";

const SESSION_PAYLOAD = "supplink-auth-v1";

function getAuthKey() {
  const loginId = process.env.LOGIN_ID;
  const loginPassword = process.env.LOGIN_PASSWORD;
  if (!loginId || !loginPassword) return null;
  return `${loginId}\u0000${loginPassword}`;
}

async function signPayload() {
  const keyText = getAuthKey();
  if (!keyText) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keyText),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(SESSION_PAYLOAD),
  );
  return `${SESSION_PAYLOAD}.${Buffer.from(signature).toString("base64url")}`;
}

export async function createSessionToken() {
  return signPayload();
}

export async function isValidSessionToken(token: string | undefined) {
  const expected = await signPayload();
  return Boolean(expected && token && token === expected);
}

export function hasLoginConfiguration() {
  return Boolean(process.env.LOGIN_ID && process.env.LOGIN_PASSWORD);
}

export function isValidCredentials(loginId: string, password: string) {
  return (
    hasLoginConfiguration() &&
    loginId === process.env.LOGIN_ID &&
    password === process.env.LOGIN_PASSWORD
  );
}