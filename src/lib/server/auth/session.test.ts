import {
  AuthenticationSession,
  AuthenticationUnavailableError,
  type SessionClient,
  type SessionCookies,
  createSessionClient,
  readTokenExpiry,
} from "./session";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@a-novel-kit/nodelib-browser/http";
import { AuthenticationApi, Role } from "@a-novel/service-authentication-rest";

const checkedCookie = "__Host-account_session_checked";

type CookieSetOptions = Parameters<SessionCookies["set"]>[2];

class MemoryCookies implements SessionCookies {
  readonly values = new Map<string, string>();
  readonly writes: Array<{ name: string; options: CookieSetOptions; value: string }> = [];
  readonly deletions: string[] = [];

  get(name: string): string | undefined {
    return this.values.get(name);
  }

  set(name: string, value: string, options: CookieSetOptions): void {
    this.values.set(name, value);
    this.writes.push({ name, options, value });
  }

  delete(name: string): void {
    this.values.delete(name);
    this.deletions.push(name);
  }
}

function createClient(): {
  [Key in keyof SessionClient]: ReturnType<typeof vi.fn<SessionClient[Key]>>;
} {
  return {
    claims: vi.fn<SessionClient["claims"]>(),
    createAnonymous: vi.fn<SessionClient["createAnonymous"]>(),
    login: vi.fn<SessionClient["login"]>(),
    refresh: vi.fn<SessionClient["refresh"]>(),
    revoke: vi.fn<SessionClient["revoke"]>(),
    verify: vi.fn<SessionClient["verify"]>(),
  };
}

function createJwt(expiry: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp: expiry })).toString("base64url");
  return `${header}.${payload}.signature`;
}

describe("AuthenticationSession", () => {
  let client: ReturnType<typeof createClient>;
  let cookies: MemoryCookies;

  beforeEach(() => {
    client = createClient();
    cookies = new MemoryCookies();
  });

  it("does not create an anonymous session during an ordinary request", async () => {
    const session = new AuthenticationSession(client, cookies);

    await expect(session.current()).resolves.toEqual({ status: "none" });
    expect(client.createAnonymous).not.toHaveBeenCalled();
  });

  it("returns verified authenticated claims without exposing cookies to the browser", async () => {
    cookies.values.set("__Host-account_access_token", "access");
    cookies.values.set("__Host-account_refresh_token", "refresh");
    cookies.values.set("__Host-account_identity_handle", "maya.chen");
    client.claims.mockResolvedValue({
      userID: "140f24ee-1531-4a9d-ace8-20b38e1b21bc",
      roles: [Role.User],
      refreshTokenID: "refresh-id",
    });
    const session = new AuthenticationSession(client, cookies);

    await expect(session.authenticated()).resolves.toMatchObject({
      status: "available",
      accessToken: "access",
      refreshToken: "refresh",
      identityHandle: "maya.chen",
      claims: { roles: [Role.User] },
    });
  });

  it("stores only the email handle in an HTTP-only identity cookie", async () => {
    client.login.mockResolvedValue({ accessToken: "access", refreshToken: "refresh" });
    const session = new AuthenticationSession(client, cookies);

    await session.login("maya.chen@example.com", "valid-password");

    expect(cookies.values.get("__Host-account_identity_handle")).toBe("maya.chen");
    expect(cookies.writes.at(-1)?.options).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it("shares one session check between the concurrent loads of a request", async () => {
    cookies.values.set("__Host-account_access_token", "access");
    client.claims.mockResolvedValue({ roles: [Role.User], userID: "test-user" });
    const session = new AuthenticationSession(client, cookies);

    const [shell, page] = await Promise.all([session.current(), session.authenticated()]);

    expect(shell).toMatchObject({ status: "available", accessToken: "access" });
    expect(page).toMatchObject({ status: "available", accessToken: "access" });
    expect(client.claims).toHaveBeenCalledOnce();
  });

  it("checks the session again once its cookies change", async () => {
    cookies.values.set("__Host-account_access_token", "access");
    client.claims.mockResolvedValue({ roles: [Role.User], userID: "test-user" });
    client.login.mockResolvedValue({ accessToken: "new-access", refreshToken: "new-refresh" });
    const session = new AuthenticationSession(client, cookies);

    await session.current();
    await session.login("maya.chen@example.com", "valid-password");

    await expect(session.current()).resolves.toMatchObject({ accessToken: "new-access" });
    expect(client.claims).toHaveBeenCalledTimes(2);
  });

  it("does not treat anonymous claims as an authenticated identity", async () => {
    cookies.values.set("__Host-account_access_token", "anonymous-access");
    client.claims.mockResolvedValue({ roles: [] });
    const session = new AuthenticationSession(client, cookies);

    await expect(session.authenticated()).resolves.toBeNull();
    expect(cookies.values.get("__Host-account_access_token")).toBe("anonymous-access");
  });

  it("refreshes a rejected access token and stores the replacement", async () => {
    cookies.values.set("__Host-account_access_token", "expired-access");
    cookies.values.set("__Host-account_refresh_token", "refresh");
    client.claims.mockRejectedValueOnce(new HttpError(403, "expired")).mockResolvedValueOnce({
      userID: "140f24ee-1531-4a9d-ace8-20b38e1b21bc",
      roles: [Role.User],
    });
    client.refresh.mockResolvedValue({
      accessToken: "fresh-access",
      refreshToken: "refresh",
    });
    const session = new AuthenticationSession(client, cookies);

    await expect(session.current()).resolves.toMatchObject({
      status: "available",
      accessToken: "fresh-access",
    });
    expect(cookies.values.get("__Host-account_access_token")).toBe("fresh-access");
    expect(client.refresh).toHaveBeenCalledWith({
      accessToken: "expired-access",
      refreshToken: "refresh",
    });
  });

  it("clears a token pair rejected during refresh", async () => {
    cookies.values.set("__Host-account_access_token", "expired-access");
    cookies.values.set("__Host-account_refresh_token", "expired-refresh");
    cookies.values.set("__Host-account_identity_handle", "maya.chen");
    client.claims.mockRejectedValue(new HttpError(403, "expired"));
    client.refresh.mockRejectedValue(new HttpError(403, "expired"));
    const session = new AuthenticationSession(client, cookies);

    await expect(session.current()).resolves.toEqual({ status: "none" });
    expect(cookies.values.size).toBe(0);
  });

  it.each(["__Host-account_refresh_token", "__Host-account_identity_handle"])(
    "clears a stale %s when the access token is missing",
    async (name) => {
      cookies.values.set(name, "stale-cookie");
      const session = new AuthenticationSession(client, cookies);

      await expect(session.current()).resolves.toEqual({ status: "none" });
      expect(cookies.values.size).toBe(0);
      expect(client.claims).not.toHaveBeenCalled();
      expect(client.refresh).not.toHaveBeenCalled();
    }
  );

  it.each([401, 403])("clears an access token rejected with %s when it cannot be refreshed", async (status) => {
    cookies.values.set("__Host-account_access_token", "expired-access");
    cookies.values.set("__Host-account_identity_handle", "maya.chen");
    client.claims.mockRejectedValue(new HttpError(status, "expired"));
    const session = new AuthenticationSession(client, cookies);

    await expect(session.current()).resolves.toEqual({ status: "none" });
    expect(cookies.values.size).toBe(0);
    expect(client.refresh).not.toHaveBeenCalled();
  });

  it("does not store a refreshed token whose claims cannot be verified", async () => {
    cookies.values.set("__Host-account_access_token", "expired-access");
    cookies.values.set("__Host-account_refresh_token", "refresh");
    client.claims.mockRejectedValue(new HttpError(401, "invalid claims"));
    client.refresh.mockResolvedValue({ accessToken: "unverified-access", refreshToken: "new-refresh" });
    const session = new AuthenticationSession(client, cookies);

    await expect(session.current()).resolves.toEqual({ status: "none" });
    expect(client.claims).toHaveBeenLastCalledWith("unverified-access");
    expect(cookies.writes).toHaveLength(0);
    expect(cookies.values.size).toBe(0);
  });

  it("reuses an existing verified session for a short-code operation", async () => {
    cookies.values.set("__Host-account_access_token", "access");
    client.claims.mockResolvedValue({ roles: [Role.User], userID: "test-user" });
    const session = new AuthenticationSession(client, cookies);

    await expect(session.anonymousAccessToken()).resolves.toBe("access");
    expect(client.createAnonymous).not.toHaveBeenCalled();
    expect(cookies.writes.map(({ name }) => name)).toEqual([checkedCookie]);
  });

  it("refuses to replace an unavailable session with an anonymous one", async () => {
    cookies.values.set("__Host-account_access_token", "access");
    client.claims.mockRejectedValue(new Error("network unavailable"));
    const session = new AuthenticationSession(client, cookies);

    await expect(session.anonymousAccessToken()).rejects.toBeInstanceOf(AuthenticationUnavailableError);
    expect(client.createAnonymous).not.toHaveBeenCalled();
    expect(cookies.values.get("__Host-account_access_token")).toBe("access");
  });

  it("creates an anonymous token only when a protected anonymous operation needs it", async () => {
    client.createAnonymous.mockResolvedValue({
      accessToken: "anonymous-access",
      refreshToken: "",
    });
    const session = new AuthenticationSession(client, cookies);

    await expect(session.anonymousAccessToken()).resolves.toBe("anonymous-access");
    expect(cookies.values.get("__Host-account_access_token")).toBe("anonymous-access");
    expect(cookies.values.has("__Host-account_refresh_token")).toBe(false);
  });

  it("keeps an anonymous token across browser restarts until it expires", async () => {
    const accessToken = createJwt(1_800_000_000);
    client.createAnonymous.mockResolvedValue({ accessToken, refreshToken: "" });
    const session = new AuthenticationSession(client, cookies);

    await session.anonymousAccessToken();

    expect(cookies.writes[0]?.options).toMatchObject({ expires: new Date(1_800_000_000 * 1000) });
  });

  it("ends a signed-in session with the browser", () => {
    const session = new AuthenticationSession(client, cookies);

    session.accept({ accessToken: createJwt(1_800_000_000), refreshToken: "refresh" });

    expect(cookies.writes[0]?.options).not.toHaveProperty("expires");
  });

  it("does not turn an authentication outage into an anonymous session", async () => {
    cookies.values.set("__Host-account_access_token", "access");
    client.claims.mockRejectedValue(new Error("network unavailable"));
    const session = new AuthenticationSession(client, cookies);

    await expect(session.authenticated()).rejects.toBeInstanceOf(AuthenticationUnavailableError);
    expect(cookies.values.get("__Host-account_access_token")).toBe("access");
  });

  it.each([
    ["an unchanged", "maya.chen@example.com", 1, ["1"]],
    ["a changed", "maya.writes@example.com", 2, ["1", "maya.writes", "1"]],
  ])("checks the session again only after %s identity handle", async (_, email, checks, writes) => {
    cookies.values.set("__Host-account_access_token", "access");
    cookies.values.set("__Host-account_identity_handle", "maya.chen");
    client.claims.mockResolvedValue({ roles: [Role.User], userID: "test-user" });
    const session = new AuthenticationSession(client, cookies);

    await session.current();
    session.rememberIdentity(email);
    await session.current();

    expect(client.claims).toHaveBeenCalledTimes(checks);
    expect(cookies.writes.map(({ value }) => value)).toEqual(writes);
  });

  it("revokes the refresh token before removing every cookie on logout", async () => {
    cookies.values.set("__Host-account_access_token", "access");
    cookies.values.set("__Host-account_refresh_token", "refresh");
    cookies.values.set("__Host-account_identity_handle", "maya.chen");
    client.claims.mockResolvedValue({ roles: [Role.User], userID: "test-user" });
    client.revoke.mockResolvedValue();
    const session = new AuthenticationSession(client, cookies);

    await session.logout();

    expect(client.revoke).toHaveBeenCalledWith("access", "refresh");
    expect(cookies.values.size).toBe(0);
  });

  it("refreshes an expired session before revoking it on logout", async () => {
    cookies.values.set("__Host-account_access_token", "expired-access");
    cookies.values.set("__Host-account_refresh_token", "refresh");
    client.claims
      .mockRejectedValueOnce(new HttpError(401, "expired"))
      .mockResolvedValueOnce({ roles: [Role.User], userID: "test-user" });
    client.refresh.mockResolvedValue({ accessToken: "fresh-access", refreshToken: "fresh-refresh" });
    client.revoke.mockResolvedValue();
    const session = new AuthenticationSession(client, cookies);

    await session.logout();

    expect(client.revoke).toHaveBeenCalledWith("fresh-access", "fresh-refresh");
    expect(cookies.values.size).toBe(0);
  });

  it.each([
    ["the revocation fails", new HttpError(503, "unavailable")],
    ["authentication is unreachable", new Error("network unavailable")],
  ])("still signs out of the browser when %s", async (_, error) => {
    cookies.values.set("__Host-account_access_token", "access");
    cookies.values.set("__Host-account_refresh_token", "refresh");
    client.claims.mockResolvedValue({ roles: [Role.User], userID: "test-user" });
    client.revoke.mockRejectedValue(error);
    const session = new AuthenticationSession(client, cookies);

    await session.logout();

    expect(cookies.values.size).toBe(0);
  });

  it.each([
    ["an anonymous session", () => client.claims.mockResolvedValue({ roles: [Role.Anon] })],
    ["an unverifiable session", () => client.claims.mockRejectedValue(new Error("network unavailable"))],
  ])("clears %s on logout without revoking it", async (_, arrange) => {
    cookies.values.set("__Host-account_access_token", "access");
    arrange();
    const session = new AuthenticationSession(client, cookies);

    await session.logout();

    expect(client.revoke).not.toHaveBeenCalled();
    expect(cookies.values.size).toBe(0);
  });

  it("uses secure HTTP-only SameSite cookies on HTTPS", () => {
    const session = new AuthenticationSession(client, cookies);

    session.accept({ accessToken: "access", refreshToken: "refresh" });

    expect(cookies.writes).toHaveLength(3);
    expect(cookies.writes[0]?.options).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    expect(cookies.writes.find(({ name }) => name === checkedCookie)?.options).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: 300,
    });
  });

  it("trusts a verified token without asking Authentication within five minutes of its last check", async () => {
    cookies.values.set("__Host-account_access_token", "access");
    cookies.values.set(checkedCookie, "1");
    client.verify.mockResolvedValue({ roles: [Role.User], userID: "test-user" });
    const session = new AuthenticationSession(client, cookies);

    await expect(session.authenticated()).resolves.toMatchObject({
      accessToken: "access",
      claims: { userID: "test-user" },
    });
    expect(client.verify).toHaveBeenCalledExactlyOnceWith("access");
    expect(client.claims).not.toHaveBeenCalled();
    expect(cookies.writes).toHaveLength(0);
  });

  it("asks Authentication, and remembers its answer for five minutes, once the last check is older", async () => {
    cookies.values.set("__Host-account_access_token", "access");
    client.claims.mockResolvedValue({ roles: [Role.User], userID: "test-user" });
    const session = new AuthenticationSession(client, cookies);

    await expect(session.current()).resolves.toMatchObject({ status: "available" });
    expect(client.verify).not.toHaveBeenCalled();
    expect(cookies.values.get(checkedCookie)).toBe("1");
  });

  it("asks Authentication when the token cannot be verified offline", async () => {
    cookies.values.set("__Host-account_access_token", "access");
    cookies.values.set(checkedCookie, "1");
    client.verify.mockRejectedValue(new Error("keys unavailable"));
    client.claims.mockResolvedValue({ roles: [Role.User], userID: "test-user" });
    const session = new AuthenticationSession(client, cookies);

    await expect(session.current()).resolves.toMatchObject({ status: "available", claims: { userID: "test-user" } });
    expect(client.claims).toHaveBeenCalledExactlyOnceWith("access");
  });

  it("reads a refreshed token's claims offline, since the refresh checked the session", async () => {
    cookies.values.set("__Host-account_access_token", "expired-access");
    cookies.values.set("__Host-account_refresh_token", "refresh");
    client.claims.mockRejectedValue(new HttpError(401, "expired"));
    client.refresh.mockResolvedValue({ accessToken: "fresh-access", refreshToken: "fresh-refresh" });
    client.verify.mockResolvedValue({ roles: [Role.User], userID: "test-user" });
    const session = new AuthenticationSession(client, cookies);

    await expect(session.current()).resolves.toMatchObject({ status: "available", accessToken: "fresh-access" });
    expect(client.verify).toHaveBeenCalledExactlyOnceWith("fresh-access");
    expect(client.claims).toHaveBeenCalledOnce();
    expect(cookies.values.get(checkedCookie)).toBe("1");
  });

  it("signs the visitor out at the first check after the session ended elsewhere", async () => {
    cookies.values.set("__Host-account_access_token", "access");
    cookies.values.set("__Host-account_refresh_token", "revoked-refresh");
    cookies.values.set(checkedCookie, "1");
    client.verify.mockRejectedValue(new Error("expired"));
    client.claims.mockRejectedValue(new HttpError(401, "signed out"));
    client.refresh.mockRejectedValue(new HttpError(401, "revoked"));
    const session = new AuthenticationSession(client, cookies);

    await expect(session.current()).resolves.toEqual({ status: "none" });
    expect(cookies.values.size).toBe(0);
  });
});

describe("readTokenExpiry", () => {
  it("reads a JWT expiry for display", () => {
    expect(readTokenExpiry(createJwt(1_800_000_000))?.toISOString()).toBe("2027-01-15T08:00:00.000Z");
  });

  it.each(["not-a-jwt", "a.invalid-json.c", createJwt(-1)])("rejects malformed or invalid expiry data", (token) => {
    expect(readTokenExpiry(token)).toBeNull();
  });
});

describe("createSessionClient", () => {
  const api = new AuthenticationApi("https://authentication.test");
  const now = new Date("2026-11-04T12:00:00Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads a verified token's claims as Authentication returns them", async () => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    const payload = {
      iss: "anovel-authentication",
      exp: now.getTime() / 1000 + 900,
      userID: "test-user",
      roles: [Role.User],
      refreshTokenID: "refresh-id",
      sessionExp: now.getTime() / 1000 + 3600,
    };
    const client = createSessionClient(api, async () => payload);

    await expect(client.verify("access")).resolves.toStrictEqual({
      userID: "test-user",
      roles: [Role.User],
      refreshTokenID: "refresh-id",
      sessionID: "refresh-id",
      sessionExp: payload.sessionExp,
      clientID: undefined,
    });
  });

  it("refuses a verified token whose session has ended", async () => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    const client = createSessionClient(api, async () => ({ userID: "test-user", sessionExp: now.getTime() / 1000 }));

    await expect(client.verify("access")).rejects.toThrow("ended");
  });

  it("refuses a token the verifier rejects", async () => {
    const client = createSessionClient(api, async () => Promise.reject(new Error("JWT expired")));

    await expect(client.verify("access")).rejects.toThrow("expired");
  });
});
