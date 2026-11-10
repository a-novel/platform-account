import { stubAuthenticationContext } from "#lib/server/auth/context.fixture.js";
import { getAuthenticationContext } from "#lib/server/auth/context.js";
import {
  type AuthenticatedSession,
  AuthenticationSession,
  AuthenticationUnavailableError,
} from "#lib/server/auth/session.js";
import { getProfileContext } from "#lib/server/profile/context.js";

import { actions as informationActions } from "./+page.server";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@a-novel-kit/nodelib-browser/http";
import {
  AuthenticationApi,
  credentialsUpdatePassword,
  shortCodeCreateEmailUpdate,
} from "@a-novel/service-authentication-rest";
import {
  ProfileApi,
  profilePictureDelete,
  profilePictureUpdate,
  profileUsernameUpdate,
} from "@a-novel/service-profile-rest";

import type { RequestEvent } from "@sveltejs/kit";

vi.mock("#lib/server/auth/context.js", { spy: true });
vi.mock("@a-novel/service-authentication-rest", { spy: true });
vi.mock("#lib/server/profile/context.js", { spy: true });
vi.mock("@a-novel/service-profile-rest", { spy: true });

const authenticated = vi.spyOn(AuthenticationSession.prototype, "authenticated");

const signedIn: AuthenticatedSession = {
  status: "available",
  accessToken: "fixture-access",
  claims: { userID: "test-user", refreshTokenID: "test-refresh", roles: [] },
};

const passwordFields = { currentPassword: "old-password", password: "new-password", confirmPassword: "new-password" };
const emailFields = { email: "new@example.test", currentPassword: "current-password" };

const profileApi = new ProfileApi("https://profile.test");
const profile = { id: "019a4e2c-7d1f-7c3a-9b2e-5f1d0c8a4b21", username: "Maya" };

function event(
  action: "password" | "email" | "username" | "picture" | "removePicture",
  fields: Record<string, string> | FormData,
  editor: string = action
): RequestEvent {
  const url = new URL(`https://account.test/account?edit=${editor}&/${action}`);
  const body = fields instanceof FormData ? fields : new URLSearchParams(fields);
  const request = {
    url,
    locals: { locale: "en" },
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    request: new Request(url, { method: "POST", body }),
  } as unknown as RequestEvent;
  vi.mocked(getAuthenticationContext).mockReturnValue(stubAuthenticationContext(request.cookies));
  vi.mocked(getProfileContext).mockReturnValue({ api: profileApi, self: vi.fn() });
  return request;
}

/** A form holding one encoded picture, as the picture dialog submits it. */
function pictureForm(type = "image/webp"): FormData {
  const form = new FormData();
  form.set("picture", new File([new Uint8Array([1, 2, 3])], "picture", { type }));
  return form;
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
      location: "/account?auth=login&returnTo=%2Faccount%3Fedit%3Dpassword",
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
            email: emailFields.email,
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
      data: {
        accountAction: { kind: "email", email: emailFields.email, state: { status: "service-error", feedback } },
      },
    });
    expect(JSON.stringify(result)).not.toContain("private service detail");
  });

  it("sends a logged-out visitor to the login before any change", async () => {
    authenticated.mockResolvedValue(null);

    await expect(informationActions.email(event("email", emailFields))).rejects.toMatchObject({
      status: 303,
      location: "/account?auth=login&returnTo=%2Faccount%3Fedit%3Demail",
    });
    expect(shortCodeCreateEmailUpdate).not.toHaveBeenCalled();
  });
});

const profileFailures = [
  ["too many attempts", new HttpError(429, "private service detail"), 429, "tooManyAttempts"],
  ["an outage", new HttpError(503, "private service detail"), 503, "serviceUnavailable"],
  ["a network failure", new Error("private service detail"), 503, "serviceUnavailable"],
] as const;

describe("username action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the name as typed, then closes the dialog on the tab", async () => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(profileUsernameUpdate).mockResolvedValue({ ...profile, username: "Maya Chen" });

    await expect(informationActions.username(event("username", { username: " Maya Chen " }))).rejects.toMatchObject({
      status: 303,
      location: "/account",
    });
    expect(profileUsernameUpdate).toHaveBeenCalledExactlyOnceWith(profileApi, "fixture-access", {
      username: " Maya Chen ",
    });
  });

  it.each([
    ["the rule the platform's mirror finds", "Maya\tChen", "characters"],
    ["a refusal only the service could tell", "Maya", "refused"],
  ])("keeps a refused name in the field, with %s", async (_, username, issue) => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(profileUsernameUpdate).mockRejectedValue(new HttpError(400, "private service detail"));

    await expect(informationActions.username(event("username", { username }))).resolves.toEqual({
      status: 400,
      data: {
        accountAction: { kind: "username", editor: { draft: username, state: { status: "validation-error", issue } } },
      },
    });
  });

  it.each(profileFailures)("keeps the form usable after %s", async (_, error, status, feedback) => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(profileUsernameUpdate).mockRejectedValue(error);

    const result = await informationActions.username(event("username", { username: "Maya" }));

    expect(result).toEqual({
      status,
      data: {
        accountAction: { kind: "username", editor: { draft: "Maya", state: { status: "service-error", feedback } } },
      },
    });
    expect(JSON.stringify(result)).not.toContain("private service detail");
  });
});

describe("picture action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the encoded picture with its type, then closes the dialog on the tab", async () => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(profilePictureUpdate).mockResolvedValue({ ...profile, pictureVersion: "2026-11-04T08:15:30.123456Z" });

    await expect(informationActions.picture(event("picture", pictureForm()))).rejects.toMatchObject({
      status: 303,
      location: "/account",
    });
    const [api, token, request] = vi.mocked(profilePictureUpdate).mock.calls[0] ?? [];
    expect([api, token, request?.picture.type, request?.picture.size]).toEqual([
      profileApi,
      "fixture-access",
      "image/webp",
      3,
    ]);
  });

  it("refuses a form without a picture before checking the session", async () => {
    await expect(informationActions.picture(event("picture", {}))).resolves.toEqual({
      status: 400,
      data: { accountAction: { kind: "picture", editor: { status: "choosing", refusal: "format" } } },
    });
    expect(authenticated).not.toHaveBeenCalled();
  });

  it.each([
    ["format", new HttpError(422, "", { reason: "format" }), "format"],
    ["ratio", new HttpError(422, "", { reason: "ratio" }), "ratio"],
    ["dimensions", new HttpError(422, "", { reason: "dimensions" }), "dimensions"],
    ["an unknown reason", new HttpError(422, "", { reason: "animated" }), "format"],
    ["a body over 256 KiB", new HttpError(413, ""), "tooLarge"],
  ])("names the service's refusal for %s", async (_, error, refusal) => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(profilePictureUpdate).mockRejectedValue(error);

    await expect(informationActions.picture(event("picture", pictureForm()))).resolves.toEqual({
      status: 422,
      data: { accountAction: { kind: "picture", editor: { status: "choosing", refusal } } },
    });
  });

  it.each(profileFailures)("keeps the dialog usable after %s", async (_, error, status, feedback) => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(profilePictureUpdate).mockRejectedValue(error);

    await expect(informationActions.picture(event("picture", pictureForm()))).resolves.toEqual({
      status,
      data: { accountAction: { kind: "picture", editor: { status: "service-error", feedback } } },
    });
  });
});

describe("removePicture action", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["removes the picture", undefined],
    ["finds nothing to remove for a profile never written", new HttpError(404, "")],
  ])("%s, then closes the dialog on the tab", async (_, error) => {
    authenticated.mockResolvedValue(signedIn);
    if (error) vi.mocked(profilePictureDelete).mockRejectedValue(error);
    else vi.mocked(profilePictureDelete).mockResolvedValue(profile);

    await expect(informationActions.removePicture(event("removePicture", {}, "picture"))).rejects.toMatchObject({
      status: 303,
      location: "/account",
    });
    expect(profilePictureDelete).toHaveBeenCalledExactlyOnceWith(profileApi, "fixture-access");
  });

  it("keeps the dialog usable after an outage", async () => {
    authenticated.mockResolvedValue(signedIn);
    vi.mocked(profilePictureDelete).mockRejectedValue(new HttpError(503, "private service detail"));

    await expect(informationActions.removePicture(event("removePicture", {}, "picture"))).resolves.toEqual({
      status: 503,
      data: { accountAction: { kind: "picture", editor: { status: "service-error", feedback: "serviceUnavailable" } } },
    });
  });
});
