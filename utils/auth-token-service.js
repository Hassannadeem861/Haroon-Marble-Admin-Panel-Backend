import crypto from "crypto";
import jwt from "jsonwebtoken";
import Session from "../models/session-model.js";

/**
 * Access + refresh token logic (ek hi jagah).
 *  - Access token: JWT, 15 minute, `Authorization: Bearer` header mein. Frontend sirf memory mein rakhta hai.
 *  - Refresh token: random string, 30 din, httpOnly cookie (path /api/v1). DB mein sirf hash.
 *    Har refresh par rotation; revoke ho chuka token dobara aaye = chori ka shak → us user ke saare sessions band.
 * Frontend Vercel rewrite se same-origin par backend ko call karta hai, is liye cookie first-party hai
 * aur `sameSite: "strict"` chalta hai (Safari bhi block nahi karta).
 */
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Do tabs ek sath refresh karein to dusri request purana token bhejti hai — itni der tak isay chori na samjho.
const ROTATION_GRACE_MS = 60 * 1000;

export const REFRESH_COOKIE = "refreshToken";

const unauthorized = (message = "Session expired. Please login again.") => {
  const err = new Error(message);
  err.status = 401;
  return err;
};

// Reset-password wale JWT_SECRET se alag secret — login token reset token ke taur par nahi chal sakta.
const accessSecret = () => {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) throw new Error("ACCESS_TOKEN_SECRET env variable is not set.");
  return secret;
};

export const signAccessToken = (user) =>
  jwt.sign({ userId: String(user._id), email: user.email, type: "access" }, accessSecret(), {
    expiresIn: ACCESS_TOKEN_TTL,
  });

export const verifyAccessToken = (token) => {
  const payload = jwt.verify(token, accessSecret());
  if (payload.type !== "access") throw unauthorized();
  return payload;
};

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const newRandomToken = () => crypto.randomBytes(48).toString("hex");

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.VERCEL === "1" || process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/v1",
});

export const setRefreshCookie = (res, token) =>
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions(), maxAge: REFRESH_TOKEN_TTL_MS });

export const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, cookieOptions());

const insertSession = (userId, token, userAgent) =>
  Session.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    userAgent: String(userAgent || "").slice(0, 300),
  });

// Login par naya session. Returns raw refresh token (sirf cookie mein jata hai).
export const createSession = async (userId, userAgent) => {
  const token = newRandomToken();
  await insertSession(userId, token, userAgent);
  return token;
};

/**
 * rotateSession(token, userAgent) -> { userId, newToken }
 * newToken null = parallel refresh ki dusri request; browser ke paas naya cookie pehle se hai,
 * sirf naya access token do. Ghalat / expire / chori ka token -> 401 error.
 */
export const rotateSession = async (token, userAgent) => {
  if (!token) throw unauthorized();

  const session = await Session.findOne({ tokenHash: hashToken(token) });
  if (!session || session.expiresAt <= new Date()) throw unauthorized();

  if (session.revokedAt) {
    const isRecentRotation =
      session.replacedByHash && Date.now() - session.revokedAt.getTime() < ROTATION_GRACE_MS;
    if (isRecentRotation) return { userId: session.userId, newToken: null };

    // Purana (rotate ho chuka) token dobara aaya — chori ka shak. Is user ke saare sessions band.
    await Session.updateMany({ userId: session.userId, revokedAt: null }, { revokedAt: new Date() });
    console.error("Refresh token reuse detected for user", String(session.userId));
    throw unauthorized();
  }

  const newToken = newRandomToken();
  // Atomic: sirf tab revoke karo jab kisi aur request ne abhi tak nahi kiya.
  const claimed = await Session.findOneAndUpdate(
    { _id: session._id, revokedAt: null },
    { revokedAt: new Date(), replacedByHash: hashToken(newToken) },
  );
  if (!claimed) return { userId: session.userId, newToken: null };

  await insertSession(session.userId, newToken, userAgent);
  return { userId: session.userId, newToken };
};

export const revokeSession = async (token) => {
  if (!token) return;
  await Session.updateOne({ tokenHash: hashToken(token), revokedAt: null }, { revokedAt: new Date() });
};
