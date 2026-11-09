import { createHmac, timingSafeEqual } from "node:crypto";

export function challengeSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("missing_challenge_secret");
  return secret;
}

export function signChallenge(payload: object, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function readChallenge<T>(token: string, secret: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, mac] = parts;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const given = Buffer.from(mac);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function unitFloat(secret: string, message: string) {
  const digest = createHmac("sha256", secret).update(message).digest();
  return digest.readUInt32BE(0) / 0x100000000;
}
