import { requireAuthorization } from "./authorization";
import { getAuthenticationContext } from "./context";
import { stubAuthenticationContext } from "./context.fixture";
import { AuthenticationSession } from "./session";
import type { AuthenticatedSession } from "./session";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@a-novel/service-authentication-rest";

import type { RequestEvent } from "@sveltejs/kit";

vi.mock("./context", () => ({ getAuthenticationContext: vi.fn() }));

const authenticated = vi.spyOn(AuthenticationSession.prototype, "authenticated");
const cookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() } as unknown as RequestEvent["cookies"];
const event = {
  cookies,
  getClientAddress: () => "192.0.2.1",
  request: new Request("https://account.test/account?panel=email"),
  url: new URL("https://account.test/account?panel=email"),
};
const session = {
  status: "available",
  accessToken: "test-access",
  claims: { userID: "test-user", roles: ["auth:user"] },
} as AuthenticatedSession;

describe("protected operations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAuthenticationContext).mockReturnValue(stubAuthenticationContext(cookies));
  });

  it("returns server credentials only after a verified account satisfies the rule", async () => {
    authenticated.mockResolvedValue(session);
    await expect(
      requireAuthorization(event, (value) => value.claims.roles?.includes(Role.User) ?? false)
    ).resolves.toMatchObject({ session });
    await requireAuthorization(event);
    expect(authenticated).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["a load", "GET", 307],
    ["a form action", "POST", 303],
  ])("redirects %s from an anonymous visitor to the modal with its page and query", async (_, method, status) => {
    authenticated.mockResolvedValue(null);
    const request = new Request(event.url, { method });
    await expect(requireAuthorization({ ...event, request })).rejects.toMatchObject({
      status,
      location: "/account?auth=login&returnTo=%2Faccount%3Fpanel%3Demail",
    });
  });

  it("locks a page asked for under an authentication dialog instead of redirecting again", async () => {
    authenticated.mockResolvedValue(null);
    const url = new URL("https://account.test/account?auth=login&returnTo=%2Faccount");
    await expect(requireAuthorization({ ...event, url, request: new Request(url) })).rejects.toMatchObject({
      status: 401,
    });
  });

  it("returns a genuine 403 when a verified account lacks permission", async () => {
    authenticated.mockResolvedValue(session);
    await expect(requireAuthorization(event, () => false)).rejects.toMatchObject({ status: 403 });
  });

  it("returns 503 without clearing cookies or evaluating permissions during an outage", async () => {
    authenticated.mockRejectedValue(new Error("network unavailable"));
    const rule = vi.fn(() => true);
    await expect(requireAuthorization(event, rule)).rejects.toMatchObject({ status: 503 });
    expect(rule).not.toHaveBeenCalled();
    expect(cookies.delete).not.toHaveBeenCalled();
  });

  it("handles an unavailable authentication configuration as an outage", async () => {
    vi.mocked(getAuthenticationContext).mockImplementation(() => {
      throw new Error("configuration unavailable");
    });
    await expect(requireAuthorization(event)).rejects.toMatchObject({ status: 503 });
    expect(cookies.delete).not.toHaveBeenCalled();
  });
});
