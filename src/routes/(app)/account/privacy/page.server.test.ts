import type { AccountCredentialsState } from "#lib/application/auth/types.js";
import { stubAuthenticationContext } from "#lib/server/auth/context.fixture.js";
import { getAuthenticationContext } from "#lib/server/auth/context.js";
import {
  type AuthenticatedSession,
  AuthenticationSession,
  AuthenticationUnavailableError,
} from "#lib/server/auth/session.js";

import type { PageServerLoadEvent } from "./$types";
import { load as loadPrivacy, actions as privacyActions } from "./+page.server";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@a-novel-kit/nodelib-browser/http";
import { AuthenticationApi, Role, credentialsUpdateLocationConsent } from "@a-novel/service-authentication-rest";

import type { RequestEvent } from "@sveltejs/kit";

vi.mock("#lib/server/auth/context.js", { spy: true });
vi.mock("@a-novel/service-authentication-rest", { spy: true });

const authenticated = vi.spyOn(AuthenticationSession.prototype, "authenticated");

const signedIn: AuthenticatedSession = {
  status: "available",
  accessToken: "fixture-access",
  claims: { userID: "test-user", roles: [Role.User] },
};

function event(fields: Record<string, string>): RequestEvent {
  const url = new URL("https://account.test/account/privacy?/locationConsent");
  const request = {
    url,
    locals: { locale: "en" },
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    request: new Request(url, { method: "POST", body: new URLSearchParams(fields) }),
  } as unknown as RequestEvent;
  vi.mocked(getAuthenticationContext).mockReturnValue(stubAuthenticationContext(request.cookies));
  return request;
}

describe("privacy tab load", () => {
  const layouts: [string, AccountCredentialsState, unknown][] = [
    [
      "ready",
      { status: "ready", email: "creator@example.test", locationConsent: true },
      { status: "ready", locationConsent: true },
    ],
    ["unavailable", { status: "unavailable" }, { status: "unavailable" }],
  ];

  it.each(layouts)("reads the consent from the layout's %s credentials", async (_, credentials, account) => {
    const parent = async () => ({ credentials });

    await expect(loadPrivacy({ parent } as unknown as PageServerLoadEvent)).resolves.toEqual({ account });
  });
});

describe("location consent action", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["records", { enabled: "on" }, true],
    ["withdraws", {}, false],
  ] as const)("%s the consent the switch submits", async (_, fields, enabled) => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(credentialsUpdateLocationConsent).mockResolvedValue(undefined);

    await expect(privacyActions.locationConsent(event(fields))).resolves.toEqual({
      account: { status: "ready", locationConsent: enabled },
    });
    expect(credentialsUpdateLocationConsent).toHaveBeenCalledExactlyOnceWith(
      expect.any(AuthenticationApi),
      "fixture-access",
      { enabled }
    );
  });

  const failures = [
    ["too many attempts", new HttpError(429, "private detail"), 429, "tooManyAttempts"],
    ["an outage", new HttpError(503, "private detail"), 503, "serviceUnavailable"],
    ["a network failure", new Error("private detail"), 503, "serviceUnavailable"],
  ] as const;

  it.each(failures)("switches back and says why after %s", async (_, error, status, feedback) => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(credentialsUpdateLocationConsent).mockRejectedValue(error);

    const result = await privacyActions.locationConsent(event({ enabled: "on" }));

    expect(result).toEqual({ status, data: { account: { status: "ready", locationConsent: false, feedback } } });
    expect(JSON.stringify(result)).not.toContain("private detail");
  });

  it("switches back while authentication cannot check the session", async () => {
    authenticated.mockRejectedValue(new AuthenticationUnavailableError());

    await expect(privacyActions.locationConsent(event({}))).resolves.toEqual({
      status: 503,
      data: { account: { status: "ready", locationConsent: true, feedback: "serviceUnavailable" } },
    });
    expect(credentialsUpdateLocationConsent).not.toHaveBeenCalled();
  });

  it("sends a logged-out visitor to the login before any change", async () => {
    authenticated.mockResolvedValue(null);

    await expect(privacyActions.locationConsent(event({ enabled: "on" }))).rejects.toMatchObject({
      status: 303,
      location: "/account?auth=login&returnTo=%2Faccount%2Fprivacy",
    });
    expect(credentialsUpdateLocationConsent).not.toHaveBeenCalled();
  });
});
