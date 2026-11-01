import { formData } from "#lib/application/auth/forms.fixture.js";

import {
  type ShortCodeClient,
  type ShortCodeCompletionContext,
  completeShortCode,
  readShortCodeModel,
} from "./short-code";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@a-novel-kit/nodelib-browser/http";

const userId = "140f24ee-1531-4a9d-ace8-20b38e1b21bc";

function encoded(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function registrationUrl(): URL {
  return new URL("https://account.test/ext/account/create?shortCode=code-123&target=" + encoded("creator@example.com"));
}

function passwordForm(value = "replacement-password"): FormData {
  return formData({ password: value, confirmPassword: value });
}

function createContext() {
  const client = {
    register: vi.fn<ShortCodeClient["register"]>(),
    resetPassword: vi.fn<ShortCodeClient["resetPassword"]>(),
    updateEmail: vi.fn<ShortCodeClient["updateEmail"]>(),
  };
  const accessToken = vi.fn<ShortCodeCompletionContext["accessToken"]>();
  const accept = vi.fn<ShortCodeCompletionContext["accept"]>();
  const rememberIdentity = vi.fn<ShortCodeCompletionContext["rememberIdentity"]>();

  accessToken.mockResolvedValue("anonymous-access");

  return {
    context: { accept, accessToken, client, rememberIdentity } satisfies ShortCodeCompletionContext,
    mocks: { accept, accessToken, rememberIdentity, ...client },
  };
}

describe("readShortCodeModel", () => {
  it("returns display-only state without raw link credentials", () => {
    const model = readShortCodeModel("register", registrationUrl());

    expect(model).toEqual({
      journey: "register",
      state: { status: "ready" },
    });
    expect(JSON.stringify(model)).not.toContain("code-123");
    expect(JSON.stringify(model)).not.toContain("creator@example.com");
  });

  it("supports clean shareable result URLs", () => {
    expect(
      readShortCodeModel("password-reset", new URL("https://account.test/ext/password/reset?result=success"))
    ).toEqual({
      journey: "password-reset",
      state: { status: "success", feedback: "passwordReset" },
    });
  });
});

describe("completeShortCode", () => {
  let setup: ReturnType<typeof createContext>;

  beforeEach(() => {
    setup = createContext();
  });

  it("validates passwords before requesting an anonymous token", async () => {
    const result = await completeShortCode("register", registrationUrl(), passwordForm(""), setup.context);

    expect(result.outcome).toBe("validation-error");
    expect(setup.mocks.accessToken).not.toHaveBeenCalled();
    expect(setup.mocks.register).not.toHaveBeenCalled();
  });

  it("creates an account and stores only the returned session", async () => {
    setup.mocks.register.mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });

    const result = await completeShortCode("register", registrationUrl(), passwordForm(), setup.context);

    expect(result.outcome).toBe("success");
    expect(setup.mocks.register).toHaveBeenCalledWith("anonymous-access", {
      email: "creator@example.com",
      password: "replacement-password",
      shortCode: "code-123",
    });
    expect(setup.mocks.accept).toHaveBeenCalledWith(
      {
        accessToken: "new-access",
        refreshToken: "new-refresh",
      },
      "creator@example.com"
    );
    expect(JSON.stringify(result.model)).not.toContain("code-123");
    expect(JSON.stringify(result.model)).not.toContain("replacement-password");
  });

  it("confirms an email update without collecting a password", async () => {
    const url = new URL(
      "https://account.test/ext/email/validate?shortCode=code-123&target=" +
        userId +
        "&source=" +
        encoded("new@example.com")
    );

    const result = await completeShortCode("email-update", url, new FormData(), setup.context);

    expect(result.outcome).toBe("success");
    expect(setup.mocks.updateEmail).toHaveBeenCalledWith("anonymous-access", {
      shortCode: "code-123",
      userID: userId,
    });
    expect(setup.mocks.rememberIdentity).toHaveBeenCalledWith("new@example.com");
  });

  it("resets a password with the parsed account target", async () => {
    const url = new URL("https://account.test/ext/password/reset?shortCode=code-123&target=" + userId);

    const result = await completeShortCode("password-reset", url, passwordForm(), setup.context);

    expect(result.outcome).toBe("success");
    expect(setup.mocks.resetPassword).toHaveBeenCalledWith("anonymous-access", {
      password: "replacement-password",
      shortCode: "code-123",
      userID: userId,
    });
  });

  it.each([403, 404, 409])("collapses rejected link status %s to one invalid state", async (status) => {
    setup.mocks.register.mockRejectedValue(new HttpError(status, "rejected"));

    const result = await completeShortCode("register", registrationUrl(), passwordForm(), setup.context);

    expect(result).toMatchObject({
      outcome: "invalid",
      model: { journey: "register", state: { status: "invalid" } },
    });
  });

  it("keeps service failures retryable without exposing the link", async () => {
    setup.mocks.register.mockRejectedValue(new Error("network unavailable"));

    const result = await completeShortCode("register", registrationUrl(), passwordForm(), setup.context);

    expect(result).toMatchObject({
      outcome: "service-error",
      model: {
        journey: "register",
        state: { status: "service-error", feedback: "serviceUnavailable" },
      },
    });
    expect(JSON.stringify(result.model)).not.toContain("code-123");
  });
});
