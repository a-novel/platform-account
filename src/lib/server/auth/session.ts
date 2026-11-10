import { isDowntimeError, isHttpStatusError } from "@a-novel-kit/nodelib-browser/http";
import type { JwtPayload } from "@a-novel-kit/nodelib-server";
import {
  AuthenticationApi,
  type Claims,
  ClaimsSchema,
  type Token,
  claimsGet,
  tokenCreate,
  tokenCreateAnon,
  tokenRefresh,
  tokenRevoke,
} from "@a-novel/service-authentication-rest";

import type { Cookies } from "@sveltejs/kit";

// The `__Host-` prefix makes the browser refuse these cookies unless they come Secure, host-only and
// on `/` (RFC 6265bis §4.1.3.2), so a sibling host cannot plant a session.
const accessTokenCookie = "__Host-account_access_token";
const refreshTokenCookie = "__Host-account_refresh_token";
const identityHandleCookie = "__Host-account_identity_handle";
// Present while Authentication's last check of the session is recent: the browser drops it once
// `sessionCheckSeconds` pass, and the next request asks Authentication again.
const sessionCheckedCookie = "__Host-account_session_checked";
const rejectedSessionStatuses = [401, 403] as const;

/**
 * How long the platform trusts a signed access token without asking Authentication whether its
 * session ended. A sign-out elsewhere reaches the platform within this time.
 */
const sessionCheckSeconds = 300;

/** SessionCookies is the part of SvelteKit's `Cookies` API the session uses. */
export interface SessionCookies {
  get(name: string): string | undefined;
  set(name: string, value: string, options: Parameters<Cookies["set"]>[2]): void;
  delete(name: string, options: Parameters<Cookies["delete"]>[1]): void;
}

/** SessionClient is the part of the authentication API the session calls. */
export interface SessionClient {
  claims(accessToken: string): Promise<Claims>;
  /** Reads the claims of an access token whose signature and expiry it checked offline. Throws on any doubt. */
  verify(accessToken: string): Promise<Claims>;
  createAnonymous(): Promise<Token>;
  login(email: string, password: string): Promise<Token>;
  refresh(token: Token): Promise<Token>;
  revoke(accessToken: string, refreshToken: string): Promise<void>;
}

/** ResolvedSession is what the session cookies prove about a visitor once their session is checked. */
export type ResolvedSession =
  | { status: "none" }
  | { status: "unavailable" }
  | { status: "downtime" }
  | {
      status: "available";
      accessToken: string;
      refreshToken?: string;
      identityHandle?: string;
      claims: Claims;
    };
/** AuthenticatedSession is an available session that belongs to a user account. */
export type AuthenticatedSession = Omit<Extract<ResolvedSession, { status: "available" }>, "claims"> & {
  claims: Claims & { userID: string };
};

/** AuthenticationUnavailableError is thrown when Authentication cannot check a session that may be valid. */
export class AuthenticationUnavailableError extends Error {
  constructor() {
    super("The authentication service is unavailable.");
    this.name = "AuthenticationUnavailableError";
  }
}

/** AuthenticationDowntimeError is thrown when Authentication refuses a check during a planned downtime. */
export class AuthenticationDowntimeError extends Error {
  constructor() {
    super("The authentication service is in a planned downtime.");
    this.name = "AuthenticationDowntimeError";
  }
}

/** AuthenticationSession keeps a visitor's tokens in HttpOnly cookies and refreshes them on demand. */
export class AuthenticationSession {
  /** The session check that the loads and actions of the request share. A cookie change discards it. */
  private check?: Promise<ResolvedSession>;

  constructor(
    private readonly client: SessionClient,
    private readonly cookies: SessionCookies
  ) {}

  /**
   * Checks the session cookies, refreshing a rejected access token. Authentication checks the session
   * at most once per `sessionCheckSeconds`, and the token's signature vouches for it in between. An
   * outage keeps the cookies.
   */
  current(): Promise<ResolvedSession> {
    this.check ??= this.resolve();
    return this.check;
  }

  private async resolve(): Promise<ResolvedSession> {
    const accessToken = this.cookies.get(accessTokenCookie);
    const refreshToken = this.cookies.get(refreshTokenCookie);

    if (!accessToken) {
      if (refreshToken || this.cookies.get(identityHandleCookie)) this.clear();
      return { status: "none" };
    }

    const verified = this.cookies.get(sessionCheckedCookie) ? await this.verify(accessToken) : null;
    if (verified) {
      return {
        status: "available",
        accessToken,
        refreshToken,
        identityHandle: this.readIdentityHandle(),
        claims: verified,
      };
    }

    try {
      const claims = await this.client.claims(accessToken);
      this.markChecked();
      return {
        status: "available",
        accessToken,
        refreshToken,
        identityHandle: this.readIdentityHandle(),
        claims,
      };
    } catch (error) {
      if (isDowntimeError(error)) return { status: "downtime" };
      if (!isHttpStatusError(error, ...rejectedSessionStatuses)) return { status: "unavailable" };
    }

    if (!refreshToken) {
      this.clear();
      return { status: "none" };
    }

    return await this.refresh(accessToken, refreshToken);
  }

  /** Renews a rejected access token. A rejected refresh token signs the visitor out. */
  private async refresh(accessToken: string, refreshToken: string): Promise<ResolvedSession> {
    try {
      const refreshed = await this.client.refresh({ accessToken, refreshToken });
      // The refresh checked the session, so the new token needs no second check.
      const claims = (await this.verify(refreshed.accessToken)) ?? (await this.client.claims(refreshed.accessToken));
      this.accept(refreshed);

      return {
        status: "available",
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken || undefined,
        identityHandle: this.readIdentityHandle(),
        claims,
      };
    } catch (error) {
      if (isHttpStatusError(error, ...rejectedSessionStatuses)) {
        this.clear();
        return { status: "none" };
      }

      return isDowntimeError(error) ? { status: "downtime" } : { status: "unavailable" };
    }
  }

  /** Returns the visitor's account session, or null for an anonymous visitor. An outage throws. */
  async authenticated(): Promise<AuthenticatedSession | null> {
    const session = await this.current();

    if (session.status === "downtime") throw new AuthenticationDowntimeError();
    if (session.status === "unavailable") throw new AuthenticationUnavailableError();
    if (session.status !== "available") return null;

    const userID = session.claims.userID;
    return userID ? { ...session, claims: { ...session.claims, userID } } : null;
  }

  /** Returns the current access token, creating an anonymous session when the visitor has none. */
  async anonymousAccessToken(): Promise<string> {
    const session = await this.current();

    if (session.status === "downtime") throw new AuthenticationDowntimeError();
    if (session.status === "unavailable") throw new AuthenticationUnavailableError();
    if (session.status === "available") return session.accessToken;

    const token = await this.client.createAnonymous();
    this.accept(token);
    return token.accessToken;
  }

  /** Signs the visitor in and remembers the handle of their email address for the shell. */
  async login(email: string, password: string): Promise<void> {
    this.accept(await this.client.login(email, password), email);
  }

  /**
   * Signs the visitor out: revokes the session's refresh token, then removes every cookie. A failed
   * revocation still signs the visitor out of this browser, which drops the token.
   */
  async logout(): Promise<void> {
    const session = await this.current();

    if (session.status === "available" && session.refreshToken) {
      try {
        await this.client.revoke(session.accessToken, session.refreshToken);
      } catch {
        // The refresh token stays valid until it expires. The trace records the failed call.
      }
    }

    this.clear();
  }

  /**
   * Stores a token pair from the service, with the identity it belongs to when known. Authentication
   * checked the session when it issued them.
   */
  accept(token: Token, identityEmail?: string): void {
    this.check = undefined;

    const options = this.cookieOptions();
    // An anonymous token outlives the browser session, so a browser restart doesn't spend the
    // visitor's few anonymous tokens. A signed-in session still ends with the browser.
    const expiry = token.refreshToken ? null : readTokenExpiry(token.accessToken);
    this.cookies.set(accessTokenCookie, token.accessToken, expiry ? { ...options, expires: expiry } : options);

    if (token.refreshToken) {
      this.cookies.set(refreshTokenCookie, token.refreshToken, options);
    } else {
      this.cookies.delete(refreshTokenCookie, { path: "/" });
    }

    this.markChecked();
    if (identityEmail) this.rememberIdentity(identityEmail);
  }

  /**
   * Keeps the local part of an email address as the shell's display handle. An unchanged handle writes
   * nothing, so the request keeps its session check.
   */
  rememberIdentity(email: string): void {
    const separator = email.lastIndexOf("@");
    const handle = separator > 0 ? email.slice(0, separator) : "";
    if (this.cookies.get(identityHandleCookie) === handle) return;

    this.check = undefined;
    if (handle.length === 0 || handle.length > 64) {
      this.cookies.delete(identityHandleCookie, { path: "/" });
      return;
    }

    this.cookies.set(identityHandleCookie, handle, this.cookieOptions());
  }

  /** Removes every session cookie, which signs the visitor out locally. */
  clear(): void {
    this.check = undefined;

    this.cookies.delete(accessTokenCookie, { path: "/" });
    this.cookies.delete(refreshTokenCookie, { path: "/" });
    this.cookies.delete(identityHandleCookie, { path: "/" });
    this.cookies.delete(sessionCheckedCookie, { path: "/" });
  }

  /** Remembers that Authentication has just checked the session. The request keeps its session check. */
  private markChecked(): void {
    this.cookies.set(sessionCheckedCookie, "1", { ...this.cookieOptions(), maxAge: sessionCheckSeconds });
  }

  /** Verifies an access token offline, or returns null when it cannot vouch for it. */
  private async verify(accessToken: string): Promise<Claims | null> {
    try {
      return await this.client.verify(accessToken);
    } catch {
      return null;
    }
  }

  private readIdentityHandle(): string | undefined {
    const handle = this.cookies.get(identityHandleCookie);
    return handle && handle.length <= 64 && !handle.includes("@") ? handle : undefined;
  }

  private cookieOptions(): Parameters<Cookies["set"]>[2] {
    return {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    };
  }
}

/** Tells whether a request carries a session, which makes its response the visitor's alone. */
export function hasSession(cookies: SessionCookies): boolean {
  return cookies.get(accessTokenCookie) !== undefined || cookies.get(refreshTokenCookie) !== undefined;
}

/** Tells whether a request carries an account's session. An anonymous session holds no refresh token. */
export function hasAccountSession(cookies: SessionCookies): boolean {
  return cookies.get(refreshTokenCookie) !== undefined;
}

/**
 * Binds the session API to an authentication client, and to the verifier of the access tokens JSON
 * keys signs for Authentication.
 */
export function createSessionClient(
  api: AuthenticationApi,
  verifyAccessToken: (accessToken: string) => Promise<JwtPayload>
): SessionClient {
  return {
    claims: async (accessToken) => await claimsGet(api, accessToken),
    verify: async (accessToken) => readSessionClaims(await verifyAccessToken(accessToken)),
    createAnonymous: async () => await tokenCreateAnon(api),
    login: async (email, password) => await tokenCreate(api, { email, password }),
    refresh: async (token) => await tokenRefresh(api, token),
    revoke: async (accessToken, refreshToken) => await tokenRevoke(api, accessToken, { refreshToken }),
  };
}

/**
 * Reads the claims `GET /v2/session` returns from a verified access token, refusing a token whose
 * session has ended, as Authentication does.
 */
function readSessionClaims(payload: JwtPayload): Claims {
  const { userID, roles, refreshTokenID, sessionID, sessionExp, clientID } = ClaimsSchema.parse(payload);
  if (sessionExp && Date.now() >= sessionExp * 1000) throw new Error("The session has ended.");

  // A token without a session ID belongs to the session its refresh token opened.
  return { userID, roles, refreshTokenID, sessionID: sessionID || refreshTokenID, sessionExp, clientID };
}

/** Reads the expiry of a JWT without verifying it, or null when the token carries no valid one. */
export function readTokenExpiry(token: string): Date | null {
  if (token.length > 4096) return null;

  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded || typeof decoded !== "object") return null;

    const expiry = (decoded as Record<string, unknown>).exp;
    if (typeof expiry !== "number" || !Number.isSafeInteger(expiry) || expiry <= 0) return null;

    const date = new Date(expiry * 1000);
    return Number.isNaN(date.valueOf()) ? null : date;
  } catch {
    return null;
  }
}
