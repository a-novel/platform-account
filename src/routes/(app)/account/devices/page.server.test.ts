import type { AccountCredentialsState } from "#lib/application/auth/types.js";
import { stubAuthenticationContext } from "#lib/server/auth/context.fixture.js";
import { getAuthenticationContext } from "#lib/server/auth/context.js";
import {
  type AuthenticatedSession,
  AuthenticationDowntimeError,
  AuthenticationSession,
  AuthenticationUnavailableError,
} from "#lib/server/auth/session.js";

import type { PageServerLoadEvent } from "./$types";
import { actions as devicesActions, load as loadDevices } from "./+page.server";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@a-novel-kit/nodelib-browser/http";
import {
  AuthenticationApi,
  Role,
  type Session,
  sessionDelete,
  sessionList,
  sessionRevoke,
  sessionRevokeOthers,
} from "@a-novel/service-authentication-rest";

import type { RequestEvent } from "@sveltejs/kit";

vi.mock("#lib/server/auth/context.js", { spy: true });
vi.mock("@a-novel/service-authentication-rest", { spy: true });

const authenticated = vi.spyOn(AuthenticationSession.prototype, "authenticated");

const signedIn: AuthenticatedSession = {
  status: "available",
  accessToken: "fixture-access",
  claims: { userID: "test-user", roles: [Role.User] },
};

const phoneID = "5a1d9e0c-8b7f-4c2a-b3e4-2f9d6c8a7e10";
const lastActiveAt = new Date("2026-11-03T18:40:00Z");

function device(patch: Partial<Session>): Session {
  return {
    id: "0c6f2bde-3d1e-4f5b-9a57-61f4c3e1b0a1",
    current: false,
    loggedOut: false,
    userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0",
    createdAt: new Date("2026-11-01T08:00:00Z"),
    lastActiveAt,
    expiresAt: new Date("2026-12-01T08:00:00Z"),
    ...patch,
  };
}

function requestEvent(path: string, fields?: Record<string, string>) {
  const url = new URL(path, "https://account.test");
  const event = {
    url,
    locals: { locale: "fr" },
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    request: new Request(url, fields && { method: "POST", body: new URLSearchParams(fields) }),
  };
  vi.mocked(getAuthenticationContext).mockReturnValue(stubAuthenticationContext(event.cookies));
  return event;
}

function loadEvent(credentials: AccountCredentialsState): PageServerLoadEvent {
  const parent = async () => ({ credentials });
  return { ...requestEvent("/account/devices"), parent } as unknown as PageServerLoadEvent;
}

function actionEvent(action: string, fields: Record<string, string> = {}): RequestEvent {
  return requestEvent(`/account/devices?/${action}`, fields) as unknown as RequestEvent;
}

const consenting: AccountCredentialsState = { status: "ready", email: "creator@example.test", locationConsent: true };

describe("devices load", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists each device by name and activity, with its place and IP only when recorded", async () => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(sessionList).mockResolvedValue([
      device({ current: true, city: "Berlin", region: "DE", ipAddress: "203.0.113.24" }),
      device({
        id: phoneID,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
        region: "DE",
      }),
      device({ id: "9e4b2c7a-1f3d-4e6b-8a0c-5d7f2b9e1c34", userAgent: "curl/8.11.0", loggedOut: true }),
    ]);
    const formatted = new Intl.DateTimeFormat("fr", { dateStyle: "medium", timeStyle: "short" }).format(lastActiveAt);

    await expect(loadDevices(loadEvent(consenting))).resolves.toEqual({
      devices: {
        status: "ready",
        devices: [
          {
            id: "0c6f2bde-3d1e-4f5b-9a57-61f4c3e1b0a1",
            current: true,
            loggedOut: false,
            browser: "Firefox",
            system: "Linux",
            form: "desktop",
            lastActiveAt: formatted,
            place: "Berlin, Allemagne",
            ipAddress: "203.0.113.24",
          },
          {
            id: phoneID,
            current: false,
            loggedOut: false,
            browser: "Safari",
            system: "iOS",
            form: "phone",
            lastActiveAt: formatted,
            place: "Allemagne",
          },
          {
            id: "9e4b2c7a-1f3d-4e6b-8a0c-5d7f2b9e1c34",
            current: false,
            loggedOut: true,
            form: "desktop",
            lastActiveAt: formatted,
          },
        ],
      },
      locationConsent: true,
    });
    expect(sessionList).toHaveBeenCalledExactlyOnceWith(expect.any(AuthenticationApi), "fixture-access");
  });

  it("lists this device first, and the others in the service's order", async () => {
    const [recent, current, older, loggedOut] = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
    ];
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(sessionList).mockResolvedValue([
      device({ id: recent }),
      device({ id: current, current: true }),
      device({ id: older }),
      device({ id: loggedOut, loggedOut: true }),
    ]);

    const { devices } = await loadDevices(loadEvent(consenting));

    expect(devices).toMatchObject({
      status: "ready",
      devices: [{ id: current }, { id: recent }, { id: older }, { id: loggedOut }],
    });
  });

  it("tells no location consent while the credentials are unavailable", async () => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(sessionList).mockResolvedValue([]);

    await expect(loadDevices(loadEvent({ status: "unavailable" }))).resolves.toEqual({
      devices: { status: "ready", devices: [] },
      locationConsent: null,
    });
  });

  it.each([
    ["the list cannot be read", () => vi.mocked(sessionList).mockRejectedValue(new HttpError(500, "private detail"))],
    [
      "authentication cannot check the session",
      () => authenticated.mockRejectedValue(new AuthenticationUnavailableError()),
    ],
  ])("hides only the list when %s", async (_, arrange) => {
    authenticated.mockResolvedValue(signedIn);
    arrange();

    await expect(loadDevices(loadEvent(consenting))).resolves.toEqual({
      devices: { status: "unavailable" },
      locationConsent: true,
    });
  });

  it("sends a logged-out visitor to the login, then back to the tab", async () => {
    authenticated.mockResolvedValue(null);

    await expect(loadDevices(loadEvent(consenting))).rejects.toMatchObject({
      status: 303,
      location: "/?auth=login&returnTo=%2Faccount%2Fdevices",
    });
    expect(sessionList).not.toHaveBeenCalled();
  });

  it("leaves a planned downtime to the maintenance page", async () => {
    authenticated.mockRejectedValue(new AuthenticationDowntimeError());

    await expect(loadDevices(loadEvent(consenting))).rejects.toMatchObject({ status: 503, body: { downtime: true } });
  });
});

describe("device actions", () => {
  beforeEach(() => vi.clearAllMocks());

  const changes = [
    ["logoutDevice", sessionRevoke, "logged-out", [{ id: phoneID }]],
    ["logoutOtherDevices", sessionRevokeOthers, "logged-out-others", []],
    ["removeDevice", sessionDelete, "removed", [{ id: phoneID }]],
  ] as const;

  it.each(changes)("%s checks the session again, then changes the devices", async (action, change, done, form) => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(change).mockResolvedValue(undefined);

    await expect(devicesActions[action](actionEvent(action, { sessionID: phoneID }))).resolves.toEqual({
      devicesAction: { status: done },
    });
    expect(authenticated).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledExactlyOnceWith(expect.any(AuthenticationApi), "fixture-access", ...form);
  });

  it.each([
    ["logoutDevice", {}],
    ["removeDevice", { sessionID: "" }],
  ] as const)("%s refuses a form that names no device", async (action, fields) => {
    await expect(devicesActions[action](actionEvent(action, fields))).resolves.toEqual({
      status: 400,
      data: { devicesAction: { status: "service-error", feedback: "serviceUnavailable" } },
    });
    expect(authenticated).not.toHaveBeenCalled();
  });

  const failures = [
    [
      "an active device, which Authentication refuses to remove",
      new HttpError(409, "private detail"),
      503,
      "serviceUnavailable",
    ],
    ["an outage", new HttpError(503, "private detail"), 503, "serviceUnavailable"],
    ["a network failure", new Error("private detail"), 503, "serviceUnavailable"],
    ["too many attempts", new HttpError(429, "private detail"), 429, "tooManyAttempts"],
  ] as const;

  it.each(failures)("keeps the tab usable after %s", async (_, error, status, feedback) => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(sessionDelete).mockRejectedValue(error);

    const result = await devicesActions.removeDevice(actionEvent("removeDevice", { sessionID: phoneID }));

    expect(result).toEqual({ status, data: { devicesAction: { status: "service-error", feedback } } });
    expect(JSON.stringify(result)).not.toContain("private detail");
  });

  it("counts a device already gone, or another account's, as removed", async () => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(sessionDelete).mockRejectedValue(new HttpError(404, "private detail"));

    await expect(devicesActions.removeDevice(actionEvent("removeDevice", { sessionID: phoneID }))).resolves.toEqual({
      devicesAction: { status: "removed" },
    });
  });

  it("keeps the tab usable while authentication cannot check the session", async () => {
    authenticated.mockRejectedValue(new AuthenticationUnavailableError());

    await expect(devicesActions.logoutOtherDevices(actionEvent("logoutOtherDevices"))).resolves.toEqual({
      status: 503,
      data: { devicesAction: { status: "service-error", feedback: "serviceUnavailable" } },
    });
    expect(sessionRevokeOthers).not.toHaveBeenCalled();
  });

  it.each(changes)("%s sends a logged-out visitor to the login before any change", async (action, change) => {
    authenticated.mockResolvedValue(null);

    await expect(devicesActions[action](actionEvent(action, { sessionID: phoneID }))).rejects.toMatchObject({
      status: 303,
      location: "/?auth=login&returnTo=%2Faccount%2Fdevices",
    });
    expect(change).not.toHaveBeenCalled();
  });
});
