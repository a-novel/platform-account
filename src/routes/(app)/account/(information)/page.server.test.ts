import { stubAuthenticationContext } from "#lib/server/auth/context.fixture.js";
import { getAuthenticationContext } from "#lib/server/auth/context.js";
import {
  type AuthenticatedSession,
  AuthenticationSession,
  AuthenticationUnavailableError,
} from "#lib/server/auth/session.js";

import { actions as informationActions } from "./+page.server";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@a-novel-kit/nodelib-browser/http";
import {
  AuthenticationApi,
  credentialsUpdatePassword,
  shortCodeCreateEmailUpdate,
} from "@a-novel/service-authentication-rest";

import type { RequestEvent } from "@sveltejs/kit";

vi.mock("#lib/server/auth/context.js", { spy: true });
vi.mock("@a-novel/service-authentication-rest", { spy: true });

const authenticated = vi.spyOn(AuthenticationSession.prototype, "authenticated");

const signedIn: AuthenticatedSession = {
  status: "available",
  accessToken: "fixture-access",
  claims: { userID: "test-user", refreshTokenID: "test-refresh", roles: [] },
};

const passwordFields = { currentPassword: "old-password", password: "new-password", confirmPassword: "new-password" };
const emailFields = { email: "new@example.test", currentPassword: "current-password" };

function event(action: "password" | "email", fields: Record<string, string>): RequestEvent {
  const url = new URL(`https://account.test/account?edit=${action}&/${action}`);
  const request = {
    url,
    locals: { locale: "en" },
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    request: new Request(url, { method: "POST", body: new URLSearchParams(fields) }),
  } as unknown as RequestEvent;
  vi.mocked(getAuthenticationContext).mockReturnValue(stubAuthenticationContext(request.cookies));
  return request;
}

describe("password action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid fields before checking the session", async () => {
    const result = await informationActions.password(
      event("password", { currentPassword: "", password: "private-value", confirmPassword: "mismatch" })
    );

    expect(result).toMatchObject({
      status: 400,
      data: { accountAction: { kind: "password", state: { status: "validation-error" } } },
    });
    expect(authenticated).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("private-value");
  });

  it("changes the password after checking the session again, without its confirmation", async () => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(credentialsUpdatePassword).mockResolvedValue({
      id: "test-user",
      email: "creator@example.test",
      role: "auth:user",
      createdAt: new Date("2026-08-01T10:00:00Z"),
      updatedAt: new Date("2026-11-04T10:00:00Z"),
    });

    await expect(informationActions.password(event("password", passwordFields))).resolves.toEqual({
      accountAction: { kind: "password", state: { status: "success", feedback: "passwordChanged" } },
    });
    expect(authenticated).toHaveBeenCalledOnce();
    expect(credentialsUpdatePassword).toHaveBeenCalledExactlyOnceWith(expect.any(AuthenticationApi), "fixture-access", {
      currentPassword: "old-password",
      password: "new-password",
    });
  });

  it("shows a rejected current password on its field instead of the access-denied page", async () => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(credentialsUpdatePassword).mockRejectedValue(new HttpError(403, "incorrect current password"));

    await expect(informationActions.password(event("password", passwordFields))).resolves.toEqual({
      status: 403,
      data: {
        accountAction: {
          kind: "password",
          state: {
            status: "validation-error",
            issues: [{ field: "currentPassword", feedback: "invalidCurrentPassword" }],
          },
        },
      },
    });
  });

  it.each([
    ["a failed change", () => vi.mocked(credentialsUpdatePassword).mockRejectedValue(new Error("private detail"))],
    ["an unreachable session check", () => authenticated.mockRejectedValue(new AuthenticationUnavailableError())],
  ])("keeps the form usable after %s", async (_, arrange) => {
    authenticated.mockResolvedValue(signedIn);
    arrange();

    const result = await informationActions.password(event("password", passwordFields));

    expect(result).toEqual({
      status: 503,
      data: { accountAction: { kind: "password", state: { status: "service-error", feedback: "serviceUnavailable" } } },
    });
    expect(JSON.stringify(result)).not.toContain("private detail");
  });

  it("sends a logged-out visitor to the login before any change", async () => {
    authenticated.mockResolvedValue(null);

    await expect(informationActions.password(event("password", passwordFields))).rejects.toMatchObject({
      status: 303,
      location: "/?auth=login&returnTo=%2Faccount%3Fedit%3Dpassword",
    });
    expect(credentialsUpdatePassword).not.toHaveBeenCalled();
  });
});

describe("email action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an invalid email before checking the session and names its field", async () => {
    const result = await informationActions.email(
      event("email", { email: "invalid-private-value", currentPassword: "current-password" })
    );

    expect(result).toEqual({
      status: 400,
      data: {
        accountAction: {
          kind: "email",
          state: { status: "validation-error", issues: [{ field: "newEmail", feedback: "email" }] },
        },
      },
    });
    expect(authenticated).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("invalid-private-value");
  });

  it("leaves the change pending once the link is on its way, in the visitor's language", async () => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(shortCodeCreateEmailUpdate).mockResolvedValue(undefined);

    await expect(informationActions.email(event("email", emailFields))).resolves.toEqual({
      accountAction: { kind: "email", state: { status: "pending-email" } },
    });
    expect(shortCodeCreateEmailUpdate).toHaveBeenCalledExactlyOnceWith(
      expect.any(AuthenticationApi),
      "fixture-access",
      { email: "new@example.test", currentPassword: "current-password", lang: "en" }
    );
  });

  const passwordRejections = [
    [403, 403, "invalidCurrentPassword"],
    [422, 400, "currentPassword"],
  ] as const;

  it.each(passwordRejections)(
    "shows a service %i on the current password field",
    async (serviceStatus, status, feedback) => {
      authenticated.mockResolvedValue(signedIn);
      vi.mocked(shortCodeCreateEmailUpdate).mockRejectedValue(new HttpError(serviceStatus, "private service detail"));

      const result = await informationActions.email(event("email", { ...emailFields, currentPassword: "wrong-one" }));

      expect(result).toEqual({
        status,
        data: {
          accountAction: {
            kind: "email",
            state: { status: "validation-error", issues: [{ field: "currentPassword", feedback }] },
          },
        },
      });
      expect(JSON.stringify(result)).not.toContain("wrong-one");
    }
  );

  const serviceFailures = [
    ["too many attempts", new HttpError(429, "private service detail"), 429, "tooManyAttempts"],
    ["an outage", new HttpError(503, "private service detail"), 503, "serviceUnavailable"],
    ["a network failure", new Error("private service detail"), 503, "serviceUnavailable"],
  ] as const;

  it.each(serviceFailures)("keeps the form usable after %s", async (_, error, status, feedback) => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(shortCodeCreateEmailUpdate).mockRejectedValue(error);

    const result = await informationActions.email(event("email", emailFields));

    expect(result).toEqual({
      status,
      data: { accountAction: { kind: "email", state: { status: "service-error", feedback } } },
    });
    expect(JSON.stringify(result)).not.toContain("private service detail");
  });

  it("sends a logged-out visitor to the login before any change", async () => {
    authenticated.mockResolvedValue(null);

    await expect(informationActions.email(event("email", emailFields))).rejects.toMatchObject({
      status: 303,
      location: "/?auth=login&returnTo=%2Faccount%3Fedit%3Demail",
    });
    expect(shortCodeCreateEmailUpdate).not.toHaveBeenCalled();
  });
});
