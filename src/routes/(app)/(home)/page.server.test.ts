import { stubAuthenticationContext } from "#lib/server/auth/context.fixture.js";
import { getAuthenticationContext } from "#lib/server/auth/context.js";
import { AuthenticationSession } from "#lib/server/auth/session.js";

import type { PageServerLoadEvent } from "./$types";
import { actions as authenticationActions, load as loadHome } from "./+page.server";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@a-novel-kit/nodelib-browser/http";
import {
  AuthenticationApi,
  Lang,
  shortCodeCreatePasswordReset,
  waitlistJoin,
} from "@a-novel/service-authentication-rest";

import type { RequestEvent } from "@sveltejs/kit";

vi.mock("#lib/server/auth/context.js", { spy: true });
vi.mock("@a-novel/service-authentication-rest", { spy: true });

function event(
  journey: string,
  fields = { email: "creator@example.test", password: "test-password" },
  returnTo?: string
): RequestEvent {
  const url = new URL(`https://account.test/?auth=${journey}`);
  if (returnTo) url.searchParams.set("returnTo", returnTo);
  const request = {
    url,
    locals: { locale: "fr" },
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    request: new Request(url, { method: "POST", body: new URLSearchParams(fields) }),
  } as unknown as RequestEvent;
  vi.mocked(getAuthenticationContext).mockReturnValue(stubAuthenticationContext(request.cookies));
  return request;
}

describe("landing page", () => {
  it.each([
    { name: "sends a visit to the account page", path: "/", want: "/account" },
    { name: "keeps the dialog a link asked for", path: "/?auth=register", want: "/account?auth=register" },
  ])("$name", ({ path, want }) => {
    const url = new URL(path, "https://account.test");
    const visit = { url, request: new Request(url) } as unknown as PageServerLoadEvent;

    expect(() => loadHome(visit)).toThrow(expect.objectContaining({ status: 307, location: want }));
  });

  it("renders a form result posted without JavaScript in place", () => {
    const url = new URL("https://account.test/?auth=login");
    const submission = { url, request: new Request(url, { method: "POST" }) } as unknown as PageServerLoadEvent;

    expect(loadHome(submission)).toBeUndefined();
  });
});

describe("authentication outcomes", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["login", "register", "reset"])(
    "rejects invalid %s fields before contacting the service",
    async (journey) => {
      const request = event(journey, { email: "invalid-private-value", password: "" });
      const result = await authenticationActions.default(request);
      expect(result).toMatchObject({
        status: 400,
        data: { authentication: { journey, state: { status: "validation-error" } } },
      });
      expect(getAuthenticationContext).not.toHaveBeenCalled();
      expect(JSON.stringify(result)).not.toContain("invalid-private-value");
    }
  );

  const loginRejections = [
    [new HttpError(401, "fixture-only detail"), 401, "invalidCredentials"],
    [new HttpError(429, "fixture-only detail"), 429, "tooManyAttempts"],
    [new Error("fixture-only detail"), 503, "serviceUnavailable"],
  ] as const;

  it.each(loginRejections)(
    "maps login rejection to %s without exposing service detail",
    async (error, status, feedback) => {
      vi.spyOn(AuthenticationSession.prototype, "login").mockRejectedValue(error);
      const result = await authenticationActions.default(event("login"));
      expect(result).toMatchObject({
        status,
        data: { authentication: { journey: "login", state: { status: "service-error", feedback } } },
      });
      expect(JSON.stringify(result)).not.toContain("fixture-only detail");
    }
  );

  const emailRequests = [
    ["register", waitlistJoin, { status: "recorded", email: "creator@example.test" }],
    ["reset", shortCodeCreatePasswordReset, { status: "pending-email", targetHint: "creator@example.test" }],
  ] as const;

  it.each(emailRequests)("acknowledges the %s outcome and handles unavailability", async (journey, send, state) => {
    vi.spyOn(AuthenticationSession.prototype, "anonymousAccessToken").mockResolvedValue("fixture-access");
    vi.mocked(send).mockResolvedValueOnce(undefined);
    await expect(authenticationActions.default(event(journey))).resolves.toEqual({
      authentication: { journey, state },
    });
    expect(send).toHaveBeenCalledWith(expect.any(AuthenticationApi), "fixture-access", {
      email: "creator@example.test",
      lang: Lang.Fr,
    });
    vi.mocked(send).mockRejectedValueOnce(new Error("private service detail"));
    await expect(authenticationActions.default(event(journey))).resolves.toMatchObject({
      status: 503,
      data: { authentication: { journey, state: { status: "service-error", feedback: "serviceUnavailable" } } },
    });
    vi.mocked(send).mockRejectedValueOnce(new HttpError(429, "private service detail"));
    await expect(authenticationActions.default(event(journey))).resolves.toMatchObject({
      status: 429,
      data: { authentication: { journey, state: { status: "service-error", feedback: "tooManyAttempts" } } },
    });
  });
});

describe("login return destination", () => {
  const returnDestinations = [
    ["/account?panel=email#email", "/account?panel=email#email"],
    ["https://attacker.invalid", "/"],
    ["/?auth=login&returnTo=%2Faccount", "/"],
  ];

  it.each(returnDestinations)("redirects to a sanitized %s only after successful login", async (returnTo, expected) => {
    const login = vi.spyOn(AuthenticationSession.prototype, "login").mockResolvedValue(undefined);
    const request = event("login", { email: "creator@example.com", password: "test-password" }, returnTo);
    await expect(authenticationActions.default(request)).rejects.toMatchObject({ status: 303, location: expected });
    expect(login).toHaveBeenCalledWith("creator@example.com", "test-password");
  });
});
