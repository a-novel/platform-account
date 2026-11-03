import { createI18n } from "#lib/i18n/instance.js";
import { logoutAuthentication } from "#lib/server/auth/logout.js";

import { actions as authenticationActions } from "./(app)/(home)/+page.server";
import { load as loadShell } from "./(app)/+layout.server";
import { actions as accountActions, load as loadAccount } from "./(app)/account/+page.server";
import { loadShortCodeRoute, submitShortCodeRoute } from "./(standalone)/ext/(short-code)/short-code.server";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@a-novel/service-authentication-rest";

import type { Cookies, RequestEvent } from "@sveltejs/kit";

const env = vi.hoisted(() => ({
  AUTHENTICATION_SERVICE_AUDIENCE: undefined,
  AUTHENTICATION_SERVICE_URL: "https://authentication.test",
  DOWNTIME_URL: undefined,
  HEALTHCHECK_TIMEOUT_MS: undefined,
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

/** The last authentication call as the service receives it, after the platform's fetch wrapper. */
function sentRequest() {
  const [url, init] = fetchService.mock.lastCall ?? [];
  return { url, method: init?.method, headers: Object.fromEntries(new Headers(init?.headers)), body: init?.body };
}

const userId = "140f24ee-1531-4a9d-ace8-20b38e1b21bc";
const credentials = {
  id: userId,
  email: "maya.chen@example.com",
  role: Role.User,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const identity = { userID: userId, roles: [Role.User] };
const tokenCookies = { account_access_token: "private-access", account_refresh_token: "private-refresh" };
const password = { password: "replacement-password", confirmPassword: "replacement-password" };
const encodedEmail = Buffer.from("maya.chen@example.com").toString("base64url");
const registrationLink = `/ext/account/create?shortCode=private-code&target=${encodedEmail}`;

function request(path: string, cookieValues: Record<string, string> = {}, fields?: Record<string, string>) {
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
    setHeaders: vi.fn(),
    request: new Request(url, fields ? { method: "POST", body: new URLSearchParams(fields) } : undefined),
  } as unknown as RequestEvent;
  return { event, cookies, values };
}

beforeEach(() => {
  env.AUTHENTICATION_SERVICE_URL = "https://authentication.test";
  fetchService.mockReset().mockRejectedValue(new Error("Unexpected authentication request"));
  vi.stubGlobal("fetch", fetchService);
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
    expect(cookies.set).toHaveBeenCalledWith("account_access_token", "anonymous-access", {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it.each(["account_exists", "already_waitlisted"])("returns the validated %s warning", async (code) => {
    const { event } = request("/?auth=register", {}, { email });
    fetchService
      .mockResolvedValueOnce(Response.json({ accessToken: "anonymous-access", refreshToken: "anonymous-refresh" }))
      .mockResolvedValueOnce(Response.json({ code, detail: "private service detail" }, { status: 409 }));
    await expect(authenticationActions.default(event)).resolves.toEqual({
      status: 409,
      data: { authentication: { journey: "register", state: { status: "conflict", code } } },
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
  it("serves an anonymous home without calling authentication", async () => {
    const { event } = request("/");
    await expect(loadShell(event)).resolves.toEqual({
      activeNavigation: "home",
      apps: { studio: "https://studio.test/auth/sign-in" },
      session: { status: "anonymous" },
      authorization: "anonymous",
    });
    expect(fetchService).not.toHaveBeenCalled();
  });

  it.each([
    ["/privacy", "privacy"],
    ["/authorize", null],
  ] as const)("marks %s with the %s rail destination", async (path, activeNavigation) => {
    await expect(loadShell(request(path).event)).resolves.toMatchObject({ activeNavigation });
  });

  it("exposes only a verified display identity to the browser", async () => {
    const { event } = request("/account", { ...tokenCookies, account_identity_handle: "maya.chen" });
    fetchService.mockResolvedValueOnce(Response.json(identity));
    await expect(loadShell(event)).resolves.toEqual({
      activeNavigation: "home",
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

  it("checks the session once for the shell and page loads of one request", async () => {
    const { event } = request("/account", tokenCookies);
    fetchService.mockImplementation(async (url) =>
      Response.json(String(url).endsWith("/credentials/self") ? credentials : identity)
    );

    await Promise.all([loadShell(event), loadAccount(event)]);

    expect(fetchService.mock.calls.map(([url]) => url)).toEqual([
      "https://authentication.test/v2/session",
      "https://authentication.test/v2/credentials/self",
    ]);
  });

  it("uses a localized account label when the identity cookie contains a full email", async () => {
    const { event } = request("/", { ...tokenCookies, account_identity_handle: "maya.chen@example.com" });
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
      activeNavigation: "home",
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
      activeNavigation: "home",
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
      account_access_token: "new-access",
      account_refresh_token: "new-refresh",
      account_identity_handle: "maya.chen",
    });
    for (const [, , options] of cookies.set.mock.calls) {
      expect(options).toEqual({ httpOnly: true, path: "/", sameSite: "lax", secure: true });
    }
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
      account_identity_handle: "maya.chen",
    });
    await expect(logoutAuthentication(event)).rejects.toMatchObject({ status: 303, location: "/" });
    expect(values.size).toBe(0);
    expect(cookies.delete.mock.calls).toEqual([
      ["account_access_token", { path: "/" }],
      ["account_refresh_token", { path: "/" }],
      ["account_identity_handle", { path: "/" }],
    ]);
    // The unreachable session check leaves nothing to revoke.
    expect(fetchService).toHaveBeenCalledOnce();
  });

  it("returns an account recap without serializing access or refresh credentials", async () => {
    const { event } = request("/account", tokenCookies);
    fetchService.mockResolvedValueOnce(Response.json(identity)).mockResolvedValueOnce(Response.json(credentials));
    await expect(loadAccount(event)).resolves.toEqual({
      authorization: "allowed",
      accountModel: {
        claims: {
          status: "ready",
          userId,
          roles: [Role.User],
          accessExpiresAt: "Non renseignée",
          refreshExpiresAt: "Non renseignée",
        },
        credentials: { status: "ready", email: credentials.email },
        passwordState: { status: "ready" },
        emailState: { status: "ready" },
        logoutState: "ready",
      },
    });
  });

  it("changes a password only after verifying the session and omits confirmation from the API request", async () => {
    const { event } = request("/account?/password", tokenCookies, {
      currentPassword: "old-password",
      ...password,
    });
    fetchService.mockResolvedValueOnce(Response.json(identity)).mockResolvedValueOnce(Response.json(credentials));
    await expect(accountActions.password(event)).resolves.toEqual({
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
    const { event } = request("/account?/password", tokenCookies, { currentPassword: "old-password", ...password });
    fetchService.mockImplementation(async (url) =>
      Response.json(String(url).endsWith("/v2/session") ? identity : credentials)
    );

    await accountActions.password(event);
    await Promise.all([loadShell(event), loadAccount(event)]);

    expect(fetchService.mock.calls.map(([url]) => url)).toEqual([
      "https://authentication.test/v2/session",
      "https://authentication.test/v2/credentials/password",
      "https://authentication.test/v2/credentials/self",
    ]);
  });

  it.each(["password", "email"] as const)("redirects anonymous %s changes before any mutation", async (action) => {
    const { event } = request(
      "/account",
      {},
      {
        currentPassword: "old-password",
        ...password,
        email: "new@example.com",
      }
    );
    await expect(accountActions[action](event)).rejects.toMatchObject({
      status: 303,
      location: "/?auth=login&returnTo=%2Faccount",
    });
    expect(fetchService).not.toHaveBeenCalled();
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
    body: { shortCode: "private-code", userID: userId },
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
            account_access_token: "registered-access",
            account_refresh_token: "registered-refresh",
            account_identity_handle: "maya.chen",
          }
        : scenario.journey === "email-update"
          ? { account_access_token: "anonymous-access", account_identity_handle: "maya.chen" }
          : { account_access_token: "anonymous-access" }
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
    expect(values.has("account_identity_handle")).toBe(false);
    expect(values.has("account_refresh_token")).toBe(false);
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
    const { event } = request("/", { account_access_token: "access", account_refresh_token: "refresh" });

    await expect(loadShell(event)).resolves.toEqual({
      activeNavigation: "home",
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
    await expect(loadAccount(request("/account", { account_access_token: "access" }).event)).rejects.toMatchObject(
      downtimeRefusal
    );
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
      loadShell(request("/", { account_access_token: "access", account_refresh_token: "refresh" }).event)
    ).resolves.toMatchObject({ session: { status: "downtime" }, authorization: "unavailable" });
    await expect(loadAccount(request("/account", { account_access_token: "access" }).event)).rejects.toMatchObject(
      downtimeRefusal
    );
  });
});
