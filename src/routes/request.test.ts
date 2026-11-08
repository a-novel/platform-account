import { createI18n } from "#lib/i18n/instance.js";
import { logoutAuthentication } from "#lib/server/auth/logout.js";

import { actions as authenticationActions } from "./(app)/(home)/+page.server";
import { load as loadShell } from "./(app)/+layout.server";
import { actions as informationActions } from "./(app)/account/(information)/+page.server";
import { load as loadAccount } from "./(app)/account/+layout.server";
import { actions as devicesActions, load as loadDevices } from "./(app)/account/devices/+page.server";
import { actions as privacyActions } from "./(app)/account/privacy/+page.server";
import { loadShortCodeRoute, submitShortCodeRoute } from "./(standalone)/ext/(short-code)/short-code.server";

import { Buffer } from "node:buffer";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { Role } from "@a-novel/service-authentication-rest";

import type { Cookies, RequestEvent } from "@sveltejs/kit";

const env = vi.hoisted(() => ({
  AUTHENTICATION_SERVICE_URL: "https://authentication.test",
  DOWNTIME_URL: undefined,
  HEALTHCHECK_TIMEOUT_MS: undefined,
  JSON_KEYS_SERVICE_URL: "https://json-keys.test",
  PROFILE_SERVICE_TOKEN_PATH: undefined as string | undefined,
  PROFILE_SERVICE_URL: "https://profile.test",
  SERVICE_TOKEN_PATH: undefined,
  STUDIO_URL: "https://studio.test",
}));

vi.mock("$app/env/private", () => env);

// The planned downtime the published document announces. A test sets one when it needs it.
const published = vi.hoisted(() => ({ downtime: null as { components: string[]; start: Date; end: Date } | null }));

vi.mock("@a-novel-kit/nodelib-server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@a-novel-kit/nodelib-server")>()),
  createDowntimeReader: () => async () => published.downtime,
}));

const fetchService = vi.fn<typeof fetch>();
// The profile service answers apart, so each test counts the calls to Authentication alone.
const fetchProfile = vi.fn<typeof fetch>();

/** The last authentication call as the service receives it, after the platform's fetch wrapper. */
function sentRequest() {
  const [url, init] = fetchService.mock.lastCall ?? [];
  return { url, method: init?.method, headers: Object.fromEntries(new Headers(init?.headers)), body: init?.body };
}

const userId = "140f24ee-1531-4a9d-ace8-20b38e1b21bc";

/** Signs an access token as JSON keys does for Authentication, with the given key. */
async function signAccessToken(privateKey: CryptoKey, claims: object): Promise<string> {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const signed = `${encode({ alg: "Ed25519", typ: "JWT", kid: "key" })}.${encode(claims)}`;
  const signature = await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(signed));

  return `${signed}.${Buffer.from(signature).toString("base64url")}`;
}
const credentials = {
  id: userId,
  email: "maya.chen@example.com",
  role: Role.User,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  locationConsent: true,
};
const identity = { userID: userId, roles: [Role.User] };
const deviceId = "5a1d9e0c-8b7f-4c2a-b3e4-2f9d6c8a7e10";
const firefox = "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0";
const tokenCookies = {
  "__Host-account_access_token": "private-access",
  "__Host-account_refresh_token": "private-refresh",
};
const password = { password: "replacement-password", confirmPassword: "replacement-password" };
const encodedEmail = Buffer.from("maya.chen@example.com").toString("base64url");
const registrationLink = `/ext/account/create?shortCode=private-code&target=${encodedEmail}`;

function request(
  path: string,
  cookieValues: Record<string, string> = {},
  fields?: Record<string, string>,
  headers?: Record<string, string>
) {
  const values = new Map(Object.entries(cookieValues));
  const cookies = {
    get: vi.fn((name: string) => values.get(name)),
    set: vi.fn<Cookies["set"]>((name, value) => {
      values.set(name, value);
    }),
    delete: vi.fn<Cookies["delete"]>((name) => {
      values.delete(name);
    }),
  };
  const url = new URL(path, "https://account.test");
  const event = {
    cookies,
    getClientAddress: () => "192.0.2.1",
    url,
    locals: { locale: "fr", i18n: createI18n("fr") },
    request: new Request(url, fields ? { method: "POST", body: new URLSearchParams(fields), headers } : { headers }),
  } as unknown as RequestEvent;
  return { event, cookies, values };
}

/** The devices tab's load event, whose parent is the account layout's load. */
function devicesEvent(event: RequestEvent, layout: ReturnType<typeof loadAccount>) {
  return { ...event, parent: () => layout } as unknown as Parameters<typeof loadDevices>[0];
}

beforeEach(() => {
  env.AUTHENTICATION_SERVICE_URL = "https://authentication.test";
  fetchService.mockReset().mockRejectedValue(new Error("Unexpected authentication request"));
  // An account holds no profile before its first write.
  fetchProfile.mockReset().mockImplementation(async () => new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", ((input, init) =>
    String(input).startsWith("https://profile.test/")
      ? fetchProfile(input, init)
      : fetchService(input, init)) satisfies typeof fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  published.downtime = null;
});

describe("invitation requests at the request boundary", () => {
  const email = "Creator@Example.test";

  it.each(["en", "fr"] as const)("records a request using the published client and %s locale", async (locale) => {
    const { event, cookies } = request("/?auth=register", {}, { email });
    event.locals.locale = locale;
    fetchService
      .mockResolvedValueOnce(Response.json({ accessToken: "anonymous-access", refreshToken: "anonymous-refresh" }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    await expect(authenticationActions.default(event)).resolves.toEqual({
      authentication: { journey: "register", state: { status: "recorded", email } },
    });
    expect(fetchService).toHaveBeenCalledTimes(2);
    expect(sentRequest()).toEqual({
      url: "https://authentication.test/v2/waitlist",
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer anonymous-access",
        "x-client-ip": "192.0.2.1",
      },
      body: JSON.stringify({ email, lang: locale }),
    });
    expect(cookies.set).toHaveBeenCalledWith("__Host-account_access_token", "anonymous-access", {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  const olderServiceConflicts = [
    ["account_exists", Response.json({ code: "account_exists" }, { status: 409 })],
    ["already_waitlisted", Response.json({ code: "already_waitlisted" }, { status: 409 })],
  ] as const;

  // A service older than v2.24.0 answers 409 for a listed or registered address.
  it.each(olderServiceConflicts)("confirms a 409 for %s like a new address", async (_, answer) => {
    const { event } = request("/?auth=register", {}, { email });
    fetchService
      .mockResolvedValueOnce(Response.json({ accessToken: "anonymous-access", refreshToken: "anonymous-refresh" }))
      .mockResolvedValueOnce(answer);
    await expect(authenticationActions.default(event)).resolves.toEqual({
      authentication: { journey: "register", state: { status: "recorded", email } },
    });
  });

  const unacknowledged = [
    ["storage unavailable", new Response("private service detail", { status: 503 })],
    ["unknown conflict", Response.json({ code: "private service detail" }, { status: 409 })],
    ["malformed conflict", new Response("private service detail", { status: 409 })],
    ["network failure", new Error("private service detail")],
  ] as const;

  it.each(unacknowledged)("never acknowledges a request after %s", async (_, outcome) => {
    const { event } = request("/?auth=register", {}, { email });
    fetchService.mockResolvedValueOnce(
      Response.json({ accessToken: "anonymous-access", refreshToken: "anonymous-refresh" })
    );
    if (outcome instanceof Error) fetchService.mockRejectedValueOnce(outcome);
    else fetchService.mockResolvedValueOnce(outcome as Response);
    await expect(authenticationActions.default(event)).resolves.toEqual({
      status: 503,
      data: {
        authentication: { journey: "register", state: { status: "service-error", feedback: "serviceUnavailable" } },
      },
    });
    expect(fetchService).toHaveBeenCalledTimes(2);
  });

  it("does not contact the waitlist when the anonymous session fails", async () => {
    const { event } = request("/?auth=register", {}, { email });
    fetchService.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(authenticationActions.default(event)).resolves.toMatchObject({ status: 503 });
    expect(fetchService).toHaveBeenCalledTimes(1);
  });
});

describe("account session at the request boundary", () => {
  it("serves an anonymous visitor without calling authentication", async () => {
    const { event } = request("/");
    await expect(loadShell(event)).resolves.toEqual({
      activeNavigation: null,
      rail: "expanded",
      apps: { studio: "https://studio.test/auth/sign-in" },
      session: { status: "anonymous" },
      authorization: "anonymous",
    });
    expect(fetchService).not.toHaveBeenCalled();
  });

  it("renders the rail the visitor left on any Agora app", async () => {
    const { event } = request("/", { "navigation-rail": "collapsed" });
    await expect(loadShell(event)).resolves.toMatchObject({ rail: "collapsed" });
  });

  it.each([
    ["/account", "account"],
    ["/account/devices", "account"],
    ["/account/privacy", "account"],
    ["/privacy", "privacy"],
    ["/authorize", null],
  ] as const)("marks %s with the %s rail destination", async (path, activeNavigation) => {
    await expect(loadShell(request(path).event)).resolves.toMatchObject({ activeNavigation });
  });

  it("exposes only a verified display identity to the browser", async () => {
    const { event } = request("/account", { ...tokenCookies, "__Host-account_identity_handle": "maya.chen" });
    fetchService.mockResolvedValueOnce(Response.json(identity));
    await expect(loadShell(event)).resolves.toEqual({
      activeNavigation: "account",
      rail: "expanded",
      apps: { studio: "https://studio.test/auth/sign-in" },
      session: { status: "authenticated", displayName: "Maya Chen", initials: "MC" },
      authorization: "allowed",
    });
    expect(fetchService).toHaveBeenCalledOnce();
    expect(sentRequest()).toEqual({
      url: "https://authentication.test/v2/session",
      method: "GET",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer private-access",
        "x-client-ip": "192.0.2.1",
      },
    });
  });

  it("verifies a recently checked session against JSON keys' public keys, without asking authentication", async () => {
    const { privateKey, publicKey } = (await crypto.subtle.generateKey("Ed25519", true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const key = {
      ...(await crypto.subtle.exportKey("jwk", publicKey)),
      kid: "key",
      alg: "Ed25519",
      use: "sig",
      key_ops: ["verify"],
    };
    const accessToken = await signAccessToken(privateKey, {
      iss: "anovel-authentication",
      aud: "anovel-client",
      sub: "user-access",
      exp: Math.floor(Date.now() / 1000) + 900,
      ...identity,
    });
    fetchService.mockImplementation(async () => Response.json([key]));
    const { event } = request("/account", {
      "__Host-account_access_token": accessToken,
      "__Host-account_identity_handle": "maya.chen",
      "__Host-account_session_checked": "1",
    });

    await expect(loadShell(event)).resolves.toMatchObject({
      session: { status: "authenticated", displayName: "Maya Chen" },
      authorization: "allowed",
    });
    expect(fetchService.mock.calls.map(([url]) => String(url))).toEqual(["https://json-keys.test/v2/jwks?usage=auth"]);
  });

  it("checks the session once for the shell, the account layout and the tab of one request", async () => {
    // The identity cookie already names the account's email, so the layout rewrites no cookie, which would discard
    // the request's session check.
    const { event } = request("/account/devices", { ...tokenCookies, "__Host-account_identity_handle": "maya.chen" });
    const answers: Record<string, unknown> = { "/v2/session": identity, "/v2/credentials/self": credentials };
    fetchService.mockImplementation(async (url) => Response.json(answers[new URL(String(url)).pathname] ?? []));

    const layout = loadAccount(event);
    await Promise.all([loadShell(event), layout, loadDevices(devicesEvent(event, layout))]);

    expect(fetchService.mock.calls.map(([url]) => url)).toEqual([
      "https://authentication.test/v2/session",
      "https://authentication.test/v2/credentials/self",
      "https://authentication.test/v2/sessions",
    ]);
  });

  it("reads the profile once for the shell and the account layout, as the platform, with the visitor's token, and names the account by its username", async () => {
    const directory = await mkdtemp(join(tmpdir(), "profile-token-"));
    env.PROFILE_SERVICE_TOKEN_PATH = join(directory, "token");
    onTestFinished(async () => {
      env.PROFILE_SERVICE_TOKEN_PATH = undefined;
      await rm(directory, { recursive: true });
    });
    await writeFile(env.PROFILE_SERVICE_TOKEN_PATH, "profile-service-token");
    const { event } = request("/account", { ...tokenCookies, "__Host-account_identity_handle": "maya.chen" });
    const answers: Record<string, unknown> = { "/v2/session": identity, "/v2/credentials/self": credentials };
    fetchService.mockImplementation(async (url) => Response.json(answers[new URL(String(url)).pathname]));
    const profile = {
      id: "019a4e2c-7d1f-7c3a-9b2e-5f1d0c8a4b21",
      username: "Maya",
      pictureVersion: "2026-11-04T08:15:30.123456Z",
    };
    fetchProfile.mockImplementation(async () => Response.json(profile));
    const picture = `/profile/picture/${profile.id}?v=2026-11-04T08%3A15%3A30.123456Z`;

    const [shell, account] = await Promise.all([loadShell(event), loadAccount(event)]);

    expect(shell.session).toEqual({ status: "authenticated", displayName: "Maya", initials: "MC", picture });
    expect(account.profile).toEqual({ status: "ready", username: "Maya", picture });
    expect(account.summary).toMatchObject({ profile: { username: "Maya", picture } });
    expect(fetchProfile).toHaveBeenCalledOnce();
    const [url, init] = fetchProfile.mock.calls[0] ?? [];
    expect(url).toBe("https://profile.test/v1/profile/self");
    expect(Object.fromEntries(new Headers(init?.headers))).toEqual({
      "content-type": "application/json",
      authorization: "Bearer private-access",
      "x-client-ip": "192.0.2.1",
      "x-service-authorization": "profile-service-token",
    });
  });

  it("keeps the session and shows initials while the profile service is unreachable", async () => {
    const { event } = request("/account", { ...tokenCookies, "__Host-account_identity_handle": "maya.chen" });
    const answers: Record<string, unknown> = { "/v2/session": identity, "/v2/credentials/self": credentials };
    fetchService.mockImplementation(async (url) => Response.json(answers[new URL(String(url)).pathname]));
    fetchProfile.mockRejectedValue(new Error("connection refused"));

    const [shell, account] = await Promise.all([loadShell(event), loadAccount(event)]);

    expect(shell.session).toEqual({ status: "authenticated", displayName: "Maya Chen", initials: "MC" });
    expect(account).toMatchObject({ authorization: "allowed", profile: { status: "unavailable" } });
  });

  it("uses a localized account label when the identity cookie contains a full email", async () => {
    const { event } = request("/", { ...tokenCookies, "__Host-account_identity_handle": "maya.chen@example.com" });
    fetchService.mockResolvedValueOnce(Response.json(identity));
    await expect(loadShell(event)).resolves.toMatchObject({
      session: { status: "authenticated", displayName: "Mon compte", initials: "A" },
    });
  });

  it("keeps anonymous service claims out of authenticated UI", async () => {
    const { event } = request("/", tokenCookies);
    fetchService.mockResolvedValueOnce(Response.json({ roles: [Role.Anon] }));
    await expect(loadShell(event)).resolves.toMatchObject({
      session: { status: "anonymous" },
      authorization: "anonymous",
    });
  });

  it("renders an unavailable session when runtime configuration is missing", async () => {
    env.AUTHENTICATION_SERVICE_URL = "";
    const { event } = request("/", tokenCookies);
    await expect(loadShell(event)).resolves.toEqual({
      activeNavigation: null,
      rail: "expanded",
      apps: null,
      session: { status: "error" },
      authorization: "unavailable",
    });
    expect(fetchService).not.toHaveBeenCalled();
  });

  it("preserves a recoverable session when refresh fails during an outage", async () => {
    const { event, values, cookies } = request("/", tokenCookies);
    fetchService
      .mockResolvedValueOnce(new Response("expired", { status: 401 }))
      .mockResolvedValueOnce(new Response("private service detail", { status: 503 }));
    await expect(loadShell(event)).resolves.toEqual({
      activeNavigation: null,
      rail: "expanded",
      apps: { studio: "https://studio.test/auth/sign-in" },
      session: { status: "error" },
      authorization: "unavailable",
    });
    expect(sentRequest()).toEqual({
      url: "https://authentication.test/v2/session",
      method: "PATCH",
      headers: { "content-type": "application/json", "x-client-ip": "192.0.2.1" },
      body: expect.any(String),
    });
    expect(JSON.parse(fetchService.mock.lastCall?.[1]?.body as string)).toEqual({
      accessToken: "private-access",
      refreshToken: "private-refresh",
    });
    expect(Object.fromEntries(values)).toEqual(tokenCookies);
    expect(cookies.set).not.toHaveBeenCalled();
    expect(cookies.delete).not.toHaveBeenCalled();
  });

  it("logs in through the service and stores credentials only in secure cookies", async () => {
    const { event, cookies, values } = request(
      "/?auth=login&returnTo=%2Faccount",
      {},
      {
        email: "maya.chen@example.com",
        password: "private-password",
      }
    );
    fetchService.mockResolvedValueOnce(Response.json({ accessToken: "new-access", refreshToken: "new-refresh" }));
    await expect(authenticationActions.default(event)).rejects.toMatchObject({ status: 303, location: "/account" });
    expect(fetchService).toHaveBeenCalledOnce();
    expect(sentRequest()).toEqual({
      url: "https://authentication.test/v2/session",
      method: "PUT",
      headers: { "content-type": "application/json", "x-client-ip": "192.0.2.1" },
      body: expect.any(String),
    });
    expect(JSON.parse(fetchService.mock.lastCall?.[1]?.body as string)).toEqual({
      email: "maya.chen@example.com",
      password: "private-password",
    });
    expect(Object.fromEntries(values)).toEqual({
      "__Host-account_access_token": "new-access",
      "__Host-account_refresh_token": "new-refresh",
      "__Host-account_identity_handle": "maya.chen",
      "__Host-account_session_checked": "1",
    });
    for (const [name, , options] of cookies.set.mock.calls) {
      const lifetime = name === "__Host-account_session_checked" ? { maxAge: 300 } : {};
      expect(options).toEqual({ httpOnly: true, path: "/", sameSite: "lax", secure: true, ...lifetime });
    }
  });

  it("names the device a login opens from the visitor's browser and estimated place", async () => {
    const { event } = request(
      "/?auth=login",
      {},
      { email: "maya.chen@example.com", password: "private-password" },
      { "User-Agent": firefox, "X-Client-Region": "FR", "X-Client-City": "Lyon" }
    );
    fetchService.mockResolvedValueOnce(Response.json({ accessToken: "new-access", refreshToken: "new-refresh" }));

    await expect(authenticationActions.default(event)).rejects.toMatchObject({ status: 303 });
    expect(sentRequest().url).toBe("https://authentication.test/v2/session");
    expect(sentRequest().headers).toEqual({
      "content-type": "application/json",
      "x-client-ip": "192.0.2.1",
      "x-client-user-agent": firefox,
      "x-client-region": "FR",
      "x-client-city": "Lyon",
    });
  });

  it("revokes the refresh token at the service on logout", async () => {
    const { event, values } = request("/auth/logout", tokenCookies);
    fetchService
      .mockResolvedValueOnce(Response.json(identity))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(logoutAuthentication(event)).rejects.toMatchObject({ status: 303, location: "/" });
    expect(sentRequest()).toEqual({
      url: "https://authentication.test/v2/session/revoke",
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer private-access",
        "x-client-ip": "192.0.2.1",
      },
      body: JSON.stringify({ refreshToken: "private-refresh" }),
    });
    expect(values.size).toBe(0);
  });

  it("logs out locally even while authentication is unreachable", async () => {
    const { event, values, cookies } = request("/auth/logout?returnTo=https://attacker.invalid", {
      ...tokenCookies,
      "__Host-account_identity_handle": "maya.chen",
    });
    await expect(logoutAuthentication(event)).rejects.toMatchObject({ status: 303, location: "/" });
    expect(values.size).toBe(0);
    expect(cookies.delete.mock.calls).toEqual([
      ["__Host-account_access_token", { path: "/" }],
      ["__Host-account_refresh_token", { path: "/" }],
      ["__Host-account_identity_handle", { path: "/" }],
      ["__Host-account_session_checked", { path: "/" }],
    ]);
    // The unreachable session check leaves nothing to revoke.
    expect(fetchService).toHaveBeenCalledOnce();
  });

  it("returns the account header without serializing access or refresh credentials", async () => {
    const sessionEnd = new Date("2026-11-10T18:40:00Z");
    const refreshToken = [
      Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
      Buffer.from(JSON.stringify({ exp: sessionEnd.getTime() / 1000 })).toString("base64url"),
      "signature",
    ].join(".");
    const { event } = request("/account", { ...tokenCookies, "__Host-account_refresh_token": refreshToken });
    fetchService.mockResolvedValueOnce(Response.json(identity)).mockResolvedValueOnce(Response.json(credentials));

    const data = await loadAccount(event);

    expect(data).toEqual({
      authorization: "allowed",
      summary: {
        status: "ready",
        roles: [Role.User],
        email: credentials.email,
        loggedInUntil: new Intl.DateTimeFormat("fr", { dateStyle: "medium", timeStyle: "short" }).format(sessionEnd),
        profile: {},
      },
      credentials: { status: "ready", email: credentials.email, locationConsent: true },
      profile: { status: "ready" },
    });
    expect(sentRequest()).toEqual({
      url: "https://authentication.test/v2/credentials/self",
      method: "GET",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer private-access",
        "x-client-ip": "192.0.2.1",
      },
    });
    expect(JSON.stringify(data)).not.toContain("private-access");
    expect(JSON.stringify(data)).not.toContain(refreshToken);
  });

  it("lists the account's devices without their raw User-Agent", async () => {
    const { event } = request("/account/devices", { ...tokenCookies, "__Host-account_identity_handle": "maya.chen" });
    const lastActiveAt = "2026-11-03T18:40:00Z";
    fetchService
      .mockResolvedValueOnce(Response.json(identity))
      .mockResolvedValueOnce(Response.json(credentials))
      .mockResolvedValueOnce(
        Response.json([
          {
            id: deviceId,
            current: true,
            loggedOut: false,
            userAgent: firefox,
            ipAddress: "203.0.113.24",
            region: "FR",
            city: "Lyon",
            createdAt: "2026-11-01T08:00:00Z",
            lastActiveAt,
            expiresAt: "2026-12-01T08:00:00Z",
          },
        ])
      );

    const data = await loadDevices(devicesEvent(event, loadAccount(event)));

    expect(data).toEqual({
      devices: {
        status: "ready",
        devices: [
          {
            id: deviceId,
            current: true,
            loggedOut: false,
            browser: "Firefox",
            system: "Linux",
            form: "desktop",
            lastActiveAt: new Intl.DateTimeFormat("fr", { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(lastActiveAt)
            ),
            place: "Lyon, France",
            ipAddress: "203.0.113.24",
          },
        ],
      },
      locationConsent: true,
    });
    expect(sentRequest()).toEqual({
      url: "https://authentication.test/v2/sessions",
      method: "GET",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer private-access",
        "x-client-ip": "192.0.2.1",
      },
    });
    expect(JSON.stringify(data)).not.toContain("Gecko");
  });

  const deviceChanges = [
    ["logoutDevice", "PUT", `/v2/sessions/${deviceId}/revoke`, devicesActions.logoutDevice, "logged-out"],
    ["logoutOtherDevices", "PUT", "/v2/sessions/revoke-others", devicesActions.logoutOtherDevices, "logged-out-others"],
    ["removeDevice", "DELETE", `/v2/sessions/${deviceId}`, devicesActions.removeDevice, "removed"],
  ] as const;

  it.each(deviceChanges)("%s sends %s %s after verifying the session", async (name, method, path, action, status) => {
    const { event } = request(`/account/devices?/${name}`, tokenCookies, { sessionID: deviceId });
    fetchService
      .mockResolvedValueOnce(Response.json(identity))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(action(event)).resolves.toEqual({ devicesAction: { status } });
    expect(fetchService).toHaveBeenCalledTimes(2);
    expect(sentRequest()).toEqual({
      url: `https://authentication.test${path}`,
      method,
      headers: { authorization: "Bearer private-access", "x-client-ip": "192.0.2.1" },
    });
  });

  it("records the location consent after verifying the session", async () => {
    const { event } = request("/account/privacy?/locationConsent", tokenCookies, { enabled: "on" });
    fetchService
      .mockResolvedValueOnce(Response.json(identity))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(privacyActions.locationConsent(event)).resolves.toEqual({
      account: { status: "ready", locationConsent: true },
    });
    expect(sentRequest()).toEqual({
      url: "https://authentication.test/v2/credentials/location-consent",
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer private-access",
        "x-client-ip": "192.0.2.1",
      },
      body: JSON.stringify({ enabled: true }),
    });
  });

  it("changes a password only after verifying the session and omits confirmation from the API request", async () => {
    const { event } = request("/account?edit=password&/password", tokenCookies, {
      currentPassword: "old-password",
      ...password,
    });
    fetchService.mockResolvedValueOnce(Response.json(identity)).mockResolvedValueOnce(Response.json(credentials));
    await expect(informationActions.password(event)).resolves.toEqual({
      accountAction: { kind: "password", state: { status: "success", feedback: "passwordChanged" } },
    });
    expect(fetchService).toHaveBeenCalledTimes(2);
    expect(sentRequest()).toEqual({
      url: "https://authentication.test/v2/credentials/password",
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer private-access",
        "x-client-ip": "192.0.2.1",
      },
      body: expect.any(String),
    });
    expect(JSON.parse(fetchService.mock.lastCall?.[1]?.body as string)).toEqual({
      currentPassword: "old-password",
      password: password.password,
    });
  });

  it("reuses an account action's session check for the loads that render its result", async () => {
    const { event } = request("/account?edit=password&/password", tokenCookies, {
      currentPassword: "old-password",
      ...password,
    });
    fetchService.mockImplementation(async (url) =>
      Response.json(String(url).endsWith("/v2/session") ? identity : credentials)
    );

    await informationActions.password(event);
    await Promise.all([loadShell(event), loadAccount(event)]);

    expect(fetchService.mock.calls.map(([url]) => url)).toEqual([
      "https://authentication.test/v2/session",
      "https://authentication.test/v2/credentials/password",
      "https://authentication.test/v2/credentials/self",
    ]);
  });

  const accountChanges = [
    ["password", "/account", informationActions.password],
    ["email", "/account", informationActions.email],
    ["logoutDevice", "/account/devices", devicesActions.logoutDevice],
    ["logoutOtherDevices", "/account/devices", devicesActions.logoutOtherDevices],
    ["removeDevice", "/account/devices", devicesActions.removeDevice],
    ["locationConsent", "/account/privacy", privacyActions.locationConsent],
    ["username", "/account", informationActions.username],
    ["removePicture", "/account", informationActions.removePicture],
  ] as const;

  it.each(accountChanges)("redirects an anonymous %s change before any mutation", async (name, path, action) => {
    const { event } = request(
      `${path}?/${name}`,
      {},
      {
        currentPassword: "old-password",
        ...password,
        email: "new@example.com",
        sessionID: deviceId,
        enabled: "on",
      }
    );
    await expect(action(event)).rejects.toMatchObject({
      status: 303,
      location: `/account?auth=login&returnTo=${encodeURIComponent(path)}`,
    });
    expect(fetchService).not.toHaveBeenCalled();
    expect(fetchProfile).not.toHaveBeenCalled();
  });
});

const journeys = [
  {
    journey: "register",
    path: registrationLink,
    endpoint: "/v2/credentials",
    body: { email: "maya.chen@example.com", password: password.password, shortCode: "private-code" },
    response: { accessToken: "registered-access", refreshToken: "registered-refresh" },
    continueHref: "/account",
    restartHref: "/?auth=register",
  },
  {
    journey: "password-reset",
    path: `/ext/password/reset?shortCode=private-code&target=${userId}`,
    endpoint: "/v2/credentials/password",
    body: { password: password.password, shortCode: "private-code", userID: userId },
    response: credentials,
    continueHref: "/?auth=login",
    restartHref: "/?auth=reset",
  },
  {
    journey: "email-update",
    path: `/ext/email/validate?shortCode=private-code&target=${userId}&source=${encodedEmail}`,
    endpoint: "/v2/credentials/email",
    body: { shortCode: "private-code", userID: userId, lang: "fr" },
    response: credentials,
    continueHref: "/account",
    restartHref: "/account",
  },
] as const;

describe("secure-link request boundary", () => {
  it.each(journeys)("loads $journey without returning link secrets or consuming it", async (scenario) => {
    const { event } = request(scenario.path);
    await expect(loadShortCodeRoute(scenario.journey, event)).resolves.toEqual({
      links: { continueHref: scenario.continueHref, restartHref: scenario.restartHref },
      model: { journey: scenario.journey, state: { status: "ready" } },
    });
    expect(fetchService).not.toHaveBeenCalled();
  });

  it.each(journeys)("completes $journey and redirects to a URL without credentials", async (scenario) => {
    const { event, values } = request(scenario.path, {}, scenario.journey === "email-update" ? {} : password);
    fetchService
      .mockResolvedValueOnce(Response.json({ accessToken: "anonymous-access", refreshToken: "" }))
      .mockResolvedValueOnce(Response.json(scenario.response));
    await expect(submitShortCodeRoute(scenario.journey, event)).rejects.toMatchObject({
      status: 303,
      location: event.url.pathname + "?result=success",
    });
    expect(fetchService).toHaveBeenCalledTimes(2);
    expect(sentRequest()).toEqual({
      url: "https://authentication.test" + scenario.endpoint,
      method: scenario.journey === "email-update" ? "PATCH" : "PUT",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer anonymous-access",
        "x-client-ip": "192.0.2.1",
      },
      body: expect.any(String),
    });
    expect(JSON.parse(fetchService.mock.lastCall?.[1]?.body as string)).toEqual(scenario.body);
    expect(Object.fromEntries(values)).toEqual(
      scenario.journey === "register"
        ? {
            "__Host-account_access_token": "registered-access",
            "__Host-account_refresh_token": "registered-refresh",
            "__Host-account_identity_handle": "maya.chen",
            "__Host-account_session_checked": "1",
          }
        : scenario.journey === "email-update"
          ? {
              "__Host-account_access_token": "anonymous-access",
              "__Host-account_identity_handle": "maya.chen",
              "__Host-account_session_checked": "1",
            }
          : { "__Host-account_access_token": "anonymous-access", "__Host-account_session_checked": "1" }
    );
  });

  it("returns safe field errors without creating a session or consuming the link", async () => {
    const { event } = request(registrationLink, {}, { password: "private-password", confirmPassword: "mismatch" });
    await expect(submitShortCodeRoute("register", event)).resolves.toMatchObject({
      status: 400,
      data: {
        shortCode: {
          journey: "register",
          state: { status: "validation-error", issues: [{ field: "confirmPassword", feedback: "passwordMismatch" }] },
        },
      },
    });
    expect(fetchService).not.toHaveBeenCalled();
  });

  it.each(["/ext/account/create", registrationLink + "&shortCode=duplicate"])(
    "redirects malformed link %s without contacting authentication",
    async (path) => {
      const { event } = request(path, {}, password);
      await expect(submitShortCodeRoute("register", event)).rejects.toMatchObject({
        status: 303,
        location: "/ext/account/create?result=invalid",
      });
      expect(fetchService).not.toHaveBeenCalled();
    }
  );

  it.each([403, 404, 409])("removes rejected link credentials after HTTP %s", async (status) => {
    const { event, values } = request(registrationLink, {}, password);
    fetchService
      .mockResolvedValueOnce(Response.json({ accessToken: "anonymous-access", refreshToken: "" }))
      .mockResolvedValueOnce(new Response("private rejection detail", { status }));
    await expect(submitShortCodeRoute("register", event)).rejects.toMatchObject({
      status: 303,
      location: "/ext/account/create?result=invalid",
    });
    expect(values.has("__Host-account_identity_handle")).toBe(false);
    expect(values.has("__Host-account_refresh_token")).toBe(false);
  });

  it("returns a retryable outage without echoing secrets or claiming completion", async () => {
    const { event } = request(registrationLink, {}, password);
    fetchService
      .mockResolvedValueOnce(Response.json({ accessToken: "anonymous-access", refreshToken: "" }))
      .mockResolvedValueOnce(new Response("private service detail", { status: 503 }));
    await expect(submitShortCodeRoute("register", event)).resolves.toEqual({
      status: 503,
      data: { shortCode: { journey: "register", state: { status: "service-error", feedback: "serviceUnavailable" } } },
    });
  });
});

describe("planned downtime at the request boundary", () => {
  const started = () => ({
    components: ["service-json-keys.database"],
    start: new Date(Date.now() - 60_000),
    end: new Date(Date.now() + 3_600_000),
  });
  const downtimeRefusal = { status: 503, body: { message: "Planned downtime", downtime: true } };

  it("shows a maintenance session without calling authentication once a downtime has started", async () => {
    published.downtime = started();
    const { event } = request("/", {
      "__Host-account_access_token": "access",
      "__Host-account_refresh_token": "refresh",
    });

    await expect(loadShell(event)).resolves.toEqual({
      activeNavigation: null,
      rail: "expanded",
      apps: { studio: "https://studio.test/auth/sign-in" },
      session: { status: "downtime" },
      authorization: "unavailable",
    });
    expect(fetchService).not.toHaveBeenCalled();
  });

  it("refuses sign-in, account and secure links without calling authentication", async () => {
    published.downtime = started();

    await expect(
      authenticationActions.default(request("/?auth=login", {}, { email: "a@b.test", password: "p" }).event)
    ).rejects.toMatchObject(downtimeRefusal);
    await expect(
      loadAccount(request("/account", { "__Host-account_access_token": "access" }).event)
    ).rejects.toMatchObject(downtimeRefusal);
    await expect(loadShortCodeRoute("register", request(registrationLink).event)).rejects.toMatchObject(
      downtimeRefusal
    );
    await expect(submitShortCodeRoute("register", request(registrationLink, {}, password).event)).rejects.toMatchObject(
      downtimeRefusal
    );
    expect(fetchService).not.toHaveBeenCalled();
  });

  it("locks nothing before the start, or for a service the platform doesn't use", async () => {
    const harmless = [
      { ...started(), start: new Date(Date.now() + 60_000) },
      { ...started(), components: ["service-genai.database"] },
    ];
    for (const downtime of harmless) {
      published.downtime = downtime;

      await expect(loadShortCodeRoute("register", request(registrationLink).event)).resolves.toMatchObject({
        model: { journey: "register" },
      });
      await expect(loadShell(request("/").event)).resolves.toMatchObject({ session: { status: "anonymous" } });
    }
  });

  it("treats a downtime refusal from authentication as maintenance before the document announces it", async () => {
    // A fresh response per call, since a body can only be read once.
    fetchService.mockImplementation(async () =>
      Response.json(
        { type: "about:blank", title: "Service Unavailable", status: 503, tags: { downtime: true } },
        { status: 503, headers: { "Content-Type": "application/problem+json" } }
      )
    );

    await expect(
      loadShell(
        request("/", { "__Host-account_access_token": "access", "__Host-account_refresh_token": "refresh" }).event
      )
    ).resolves.toMatchObject({ session: { status: "downtime" }, authorization: "unavailable" });
    await expect(
      loadAccount(request("/account", { "__Host-account_access_token": "access" }).event)
    ).rejects.toMatchObject(downtimeRefusal);
  });
});
