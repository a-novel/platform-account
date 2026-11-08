import { stubAuthenticationContext } from "#lib/server/auth/context.fixture.js";
import { getAuthenticationContext } from "#lib/server/auth/context.js";
import {
  type AuthenticatedSession,
  AuthenticationDowntimeError,
  AuthenticationSession,
  AuthenticationUnavailableError,
} from "#lib/server/auth/session.js";
import { getProfileContext } from "#lib/server/profile/context.js";

import { load as loadAccount } from "./+layout.server";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@a-novel-kit/nodelib-browser/http";
import { AuthenticationApi, Role, credentialsGetSelf } from "@a-novel/service-authentication-rest";
import { type Profile, ProfileApi } from "@a-novel/service-profile-rest";

import type { RequestEvent } from "@sveltejs/kit";

vi.mock("#lib/server/auth/context.js", { spy: true });
vi.mock("#lib/server/profile/context.js", { spy: true });
vi.mock("@a-novel/service-authentication-rest", { spy: true });

const authenticated = vi.spyOn(AuthenticationSession.prototype, "authenticated");
const dates = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const sessionEnd = new Date("2026-11-10T18:40:00Z");
/** The visitor's own profile, as the profile service reads it for the request. */
const readProfile = vi.fn<(accessToken: string) => Promise<Profile | null>>();

/** A refresh token as Authentication signs it. The platform reads only its expiry. */
function refreshToken(expiry: Date): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp: expiry.getTime() / 1000 })).toString("base64url");
  return `${header}.${payload}.signature`;
}

function signedIn(patch: Partial<AuthenticatedSession> = {}): AuthenticatedSession {
  return {
    status: "available",
    accessToken: "fixture-access",
    refreshToken: refreshToken(sessionEnd),
    claims: { userID: "test-user", roles: [Role.Admin, Role.User] },
    ...patch,
  };
}

function event(path = "/account"): RequestEvent {
  const url = new URL(path, "https://account.test");
  const request = {
    url,
    locals: { locale: "en" },
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    request: new Request(url),
  } as unknown as RequestEvent;
  vi.mocked(getAuthenticationContext).mockReturnValue(stubAuthenticationContext(request.cookies));
  vi.mocked(getProfileContext).mockReturnValue({ api: new ProfileApi("https://profile.test"), self: readProfile });
  return request;
}

describe("account layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readProfile.mockResolvedValue(null);
  });

  it("sends a logged-out visitor to the login, then back to the tab", async () => {
    authenticated.mockResolvedValue(null);

    await expect(loadAccount(event("/account/devices?confirm=others"))).rejects.toMatchObject({
      status: 307,
      location: "/account?auth=login&returnTo=%2Faccount%2Fdevices%3Fconfirm%3Dothers",
    });
    expect(credentialsGetSelf).not.toHaveBeenCalled();
  });

  it("heads the tabs with the current email, never the pending one, and the session's end", async () => {
    const request = event();
    authenticated.mockResolvedValue(signedIn());
    const expiresAt = new Date("2026-11-04T18:40:00Z");
    vi.mocked(credentialsGetSelf).mockResolvedValue({
      id: "test-user",
      email: "creator@example.test",
      role: Role.Admin,
      createdAt: new Date("2026-08-01T10:00:00Z"),
      updatedAt: new Date("2026-08-01T10:00:00Z"),
      locationConsent: true,
      pendingEmail: { email: "new@example.test", expiresAt },
    });

    await expect(loadAccount(request)).resolves.toEqual({
      authorization: "allowed",
      summary: {
        status: "ready",
        roles: [Role.Admin, Role.User],
        email: "creator@example.test",
        loggedInUntil: dates.format(sessionEnd),
        profile: {},
      },
      credentials: {
        status: "ready",
        email: "creator@example.test",
        pendingEmail: { email: "new@example.test", expiresAt: dates.format(expiresAt) },
        locationConsent: true,
      },
      profile: { status: "ready" },
    });
    expect(credentialsGetSelf).toHaveBeenCalledExactlyOnceWith(expect.any(AuthenticationApi), "fixture-access");
    // The shell names the visitor after the current email from now on.
    expect(request.cookies.set).toHaveBeenCalledWith("__Host-account_identity_handle", "creator", expect.anything());
  });

  it.each([
    ["no refresh token", undefined],
    ["an unreadable refresh token", "not-a-jwt"],
  ])("states no session end and no role for %s", async (_, token) => {
    authenticated.mockResolvedValue(signedIn({ refreshToken: token, claims: { userID: "test-user" } }));
    vi.mocked(credentialsGetSelf).mockResolvedValue({
      id: "test-user",
      email: "creator@example.test",
      role: Role.User,
      createdAt: new Date("2026-08-01T10:00:00Z"),
      updatedAt: new Date("2026-08-01T10:00:00Z"),
      locationConsent: false,
    });

    const { summary } = await loadAccount(event());

    expect(summary).toEqual({ status: "ready", roles: [], email: "creator@example.test", profile: {} });
  });

  it("keeps the header and the tabs when the credentials cannot be read", async () => {
    const request = event();
    authenticated.mockResolvedValue(signedIn());
    vi.mocked(credentialsGetSelf).mockRejectedValue(new HttpError(500, "private service detail"));

    await expect(loadAccount(request)).resolves.toEqual({
      authorization: "allowed",
      summary: {
        status: "ready",
        roles: [Role.Admin, Role.User],
        loggedInUntil: dates.format(sessionEnd),
        profile: {},
      },
      credentials: { status: "unavailable" },
      profile: { status: "ready" },
    });
    expect(request.cookies.set).not.toHaveBeenCalled();
  });

  it("shows the public profile in the header and the tab, its picture under a versioned address", async () => {
    authenticated.mockResolvedValue(signedIn());
    vi.mocked(credentialsGetSelf).mockRejectedValue(new HttpError(500, "private service detail"));
    readProfile.mockResolvedValue({
      id: "019a4e2c-7d1f-7c3a-9b2e-5f1d0c8a4b21",
      username: "Maya",
      pictureVersion: "2026-11-04T08:15:30.123456Z",
    });
    const picture = "/profile/picture/019a4e2c-7d1f-7c3a-9b2e-5f1d0c8a4b21?v=2026-11-04T08%3A15%3A30.123456Z";

    const data = await loadAccount(event());

    expect(data.profile).toEqual({ status: "ready", username: "Maya", picture });
    expect(data.summary).toMatchObject({ profile: { username: "Maya", picture } });
    expect(readProfile).toHaveBeenCalledExactlyOnceWith("fixture-access");
  });

  it("keeps the header and the credentials when the profile cannot be read", async () => {
    authenticated.mockResolvedValue(signedIn());
    vi.mocked(credentialsGetSelf).mockRejectedValue(new HttpError(500, "private service detail"));
    readProfile.mockRejectedValue(new HttpError(503, "private service detail"));

    const data = await loadAccount(event());

    expect(data.profile).toEqual({ status: "unavailable" });
    expect(data.summary).toEqual({
      status: "ready",
      roles: [Role.Admin, Role.User],
      loggedInUntil: dates.format(sessionEnd),
    });
  });

  it("keeps the tabs while authentication cannot check the session", async () => {
    authenticated.mockRejectedValue(new AuthenticationUnavailableError());

    await expect(loadAccount(event())).resolves.toEqual({
      authorization: "unavailable",
      summary: { status: "error", feedback: "sessionUnavailable" },
      credentials: { status: "unavailable" },
      profile: { status: "unavailable" },
    });
    expect(credentialsGetSelf).not.toHaveBeenCalled();
  });

  it("leaves a planned downtime to the maintenance page", async () => {
    authenticated.mockRejectedValue(new AuthenticationDowntimeError());

    await expect(loadAccount(event())).rejects.toMatchObject({ status: 503, body: { downtime: true } });
  });
});
