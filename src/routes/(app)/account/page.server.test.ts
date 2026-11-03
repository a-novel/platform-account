import { createI18n } from "#lib/i18n/instance.js";
import { stubAuthenticationContext } from "#lib/server/auth/context.fixture.js";
import { getAuthenticationContext } from "#lib/server/auth/context.js";
import {
  type AuthenticatedSession,
  AuthenticationSession,
  AuthenticationUnavailableError,
} from "#lib/server/auth/session.js";

import { actions as accountActions, load as loadAccount } from "./+page.server";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@a-novel-kit/nodelib-browser/http";
import {
  credentialsGetSelf,
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

function event(
  request = new Request("https://account.test/account?/password", {
    method: "POST",
    body: new URLSearchParams({
      currentPassword: "old-password",
      password: "new-password",
      confirmPassword: "new-password",
    }),
  })
): RequestEvent {
  return {
    url: new URL("https://account.test/account"),
    locals: { locale: "en", i18n: createI18n("en") },
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    request,
    setHeaders: vi.fn(),
  } as unknown as RequestEvent;
}

describe("account route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const request = event();
    vi.mocked(getAuthenticationContext).mockReturnValue(stubAuthenticationContext(request.cookies, request.url));
  });

  it("keeps the account page out of every cache", async () => {
    authenticated.mockRejectedValue(new AuthenticationUnavailableError());
    const request = event();

    await loadAccount(request);

    expect(request.setHeaders).toHaveBeenCalledExactlyOnceWith({ "cache-control": "no-store" });
  });

  it("limits a retrieval failure to the recap and initializes usable actions", async () => {
    authenticated.mockRejectedValue(new AuthenticationUnavailableError());
    await expect(loadAccount(event())).resolves.toEqual({
      authorization: "unavailable",
      accountModel: {
        claims: { status: "error", feedback: "sessionUnavailable" },
        credentials: { status: "unavailable" },
        passwordState: { status: "ready" },
        emailState: { status: "ready" },
        logoutState: "ready",
      },
    });
  });

  it("shows the account email and its pending change, and names the shell after that email", async () => {
    const request = event();
    vi.mocked(getAuthenticationContext).mockReturnValue(stubAuthenticationContext(request.cookies, request.url));
    authenticated.mockResolvedValue(signedIn);
    const expiresAt = new Date("2026-08-18T20:30:00Z");
    vi.mocked(credentialsGetSelf).mockResolvedValue({
      id: "test-user",
      email: "creator@example.test",
      role: "auth:user",
      createdAt: new Date("2026-08-01T10:00:00Z"),
      updatedAt: new Date("2026-08-01T10:00:00Z"),
      pendingEmail: { email: "new@example.test", expiresAt },
    });

    const { accountModel } = await loadAccount(request);

    expect(credentialsGetSelf).toHaveBeenCalledWith(expect.anything(), "fixture-access");
    expect(accountModel.credentials).toEqual({
      status: "ready",
      email: "creator@example.test",
      pendingEmail: {
        email: "new@example.test",
        expiresAt: new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(expiresAt),
      },
    });
    expect(request.cookies.set).toHaveBeenCalledWith("account_identity_handle", "creator", expect.anything());
  });

  it("keeps the session recap and the forms when the email cannot be read", async () => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(credentialsGetSelf).mockRejectedValue(new HttpError(500, "unavailable"));

    await expect(loadAccount(event())).resolves.toMatchObject({
      authorization: "allowed",
      accountModel: {
        claims: { status: "ready", userId: "test-user" },
        credentials: { status: "unavailable" },
        emailState: { status: "ready" },
      },
    });
  });

  it("redirects a definitively anonymous request to login", async () => {
    authenticated.mockResolvedValue(null);
    await expect(loadAccount(event())).rejects.toMatchObject({
      status: 303,
      location: "/?auth=login&returnTo=%2Faccount",
    });
  });

  it("rechecks authentication before a form can change a password", async () => {
    authenticated.mockRejectedValue(new AuthenticationUnavailableError());
    const result = await accountActions.password(event());
    expect(authenticated).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: 503,
      data: { accountAction: { kind: "password", state: { status: "service-error", feedback: "serviceUnavailable" } } },
    });
    expect(credentialsUpdatePassword).not.toHaveBeenCalled();
  });

  it("keeps a rejected current password in the form instead of showing the generic access-denied page", async () => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(credentialsUpdatePassword).mockRejectedValue(new HttpError(403, "incorrect current password"));
    await expect(accountActions.password(event())).resolves.toMatchObject({
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

  it("leaves an email change pending after sending its confirmation link", async () => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(shortCodeCreateEmailUpdate).mockResolvedValue(undefined);
    const request = event(
      new Request("https://account.test/account?/email", {
        method: "POST",
        body: new URLSearchParams({ email: "new@example.test" }),
      })
    );

    await expect(accountActions.email(request)).resolves.toEqual({
      accountAction: {
        kind: "email",
        state: { status: "pending-email" },
      },
    });
    expect(shortCodeCreateEmailUpdate).toHaveBeenCalledOnce();
  });

  it("rejects invalid email before calling the service and names the account control", async () => {
    const request = event(
      new Request("https://account.test/account?/email", {
        method: "POST",
        body: new URLSearchParams({ email: "invalid-private-value" }),
      })
    );
    const result = await accountActions.email(request);
    expect(result).toMatchObject({
      status: 400,
      data: {
        accountAction: {
          kind: "email",
          state: {
            status: "validation-error",
            issues: [{ field: "newEmail", feedback: "email" }],
          },
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("invalid-private-value");
    expect(shortCodeCreateEmailUpdate).not.toHaveBeenCalled();
  });
});
