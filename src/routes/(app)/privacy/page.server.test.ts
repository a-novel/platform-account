import { stubAuthenticationContext } from "#lib/server/auth/context.fixture.js";
import { getAuthenticationContext } from "#lib/server/auth/context.js";
import {
  type AuthenticatedSession,
  AuthenticationSession,
  AuthenticationUnavailableError,
} from "#lib/server/auth/session.js";

import { load as loadPrivacy } from "./+page.server";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@a-novel/service-authentication-rest";

import type { RequestEvent } from "@sveltejs/kit";

vi.mock("#lib/server/auth/context.js", { spy: true });

const authenticated = vi.spyOn(AuthenticationSession.prototype, "authenticated");

function event(): RequestEvent {
  const url = new URL("https://account.test/privacy");
  const request = {
    url,
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    request: new Request(url),
  } as unknown as RequestEvent;
  vi.mocked(getAuthenticationContext).mockReturnValue(stubAuthenticationContext(request.cookies));
  return request;
}

describe("public privacy page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a logged-in visitor to the account's privacy tab", async () => {
    const session: AuthenticatedSession = {
      status: "available",
      accessToken: "fixture-access",
      claims: { userID: "test-user", roles: [Role.User] },
    };
    authenticated.mockResolvedValue(session);

    await expect(loadPrivacy(event())).rejects.toMatchObject({ status: 307, location: "/account/privacy" });
  });

  it.each([
    ["a logged-out visitor", () => authenticated.mockResolvedValue(null)],
    [
      "a visitor whose session cannot be checked",
      () => authenticated.mockRejectedValue(new AuthenticationUnavailableError()),
    ],
  ])("shows the public page to %s", async (_, arrange) => {
    arrange();

    await expect(loadPrivacy(event())).resolves.toBeUndefined();
    expect(authenticated).toHaveBeenCalledOnce();
  });
});
