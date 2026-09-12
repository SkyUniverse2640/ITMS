import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SessionUser } from "@/types";

const rawSecret = process.env.JWT_SECRET;
if (!rawSecret && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET environment variable is required in production");
}
const JWT_SECRET = new TextEncoder().encode(
  rawSecret || "nexusdesk-dev-only-secret"
);

const COOKIE_NAME = "nexusdesk-token";

export async function signToken(payload: SessionUser): Promise<string> {
  const plain = JSON.parse(JSON.stringify(payload));
  return new SignJWT(plain)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
