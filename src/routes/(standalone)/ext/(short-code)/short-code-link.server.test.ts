import { parseShortCodeLink } from "./short-code-link.server";

import { describe, expect, it } from "vitest";

function encoded(value: string): string {
  return Buffer.from(value).toString("base64url");
}

describe("parseShortCodeLink", () => {
  it("parses a registration link and keeps the raw values server-side", () => {
    const url = new URL(
      `https://account.test/ext/account/create?shortCode=code-123&target=${encoded("Creator@Example.com")}`
    );

    expect(parseShortCodeLink("register", url)).toEqual({
      status: "ready",
      journey: "register",
      email: "creator@example.com",
      shortCode: "code-123",
    });
  });

  it("parses an email-update link with its display-only source", () => {
    const userId = "140f24ee-1531-4a9d-ace8-20b38e1b21bc";
    const url = new URL(
      `https://account.test/ext/email/validate?shortCode=code-123&target=${userId}&source=${encoded("new@example.com")}`
    );

    expect(parseShortCodeLink("email-update", url)).toEqual({
      status: "ready",
      journey: "email-update",
      email: "new@example.com",
      shortCode: "code-123",
      userId,
    });
  });

  it("parses a password-reset link without exposing its user ID as a hint", () => {
    const userId = "140f24ee-1531-4a9d-ace8-20b38e1b21bc";
    const url = new URL(`https://account.test/ext/password/reset?shortCode=code-123&target=${userId}`);

    expect(parseShortCodeLink("password-reset", url)).toEqual({
      status: "ready",
      journey: "password-reset",
      shortCode: "code-123",
      userId,
    });
  });

  it("treats absent parameters as missing and duplicates as invalid", () => {
    expect(parseShortCodeLink("register", new URL("https://account.test/ext/account/create"))).toEqual({
      status: "missing",
    });

    const duplicate = new URL(
      `https://account.test/ext/account/create?shortCode=one&shortCode=two&target=${encoded("a@example.com")}`
    );
    expect(parseShortCodeLink("register", duplicate)).toEqual({ status: "invalid" });
  });

  it("rejects malformed targets before any service operation", () => {
    const url = new URL("https://account.test/ext/password/reset?shortCode=code-123&target=not-a-user-id");
    expect(parseShortCodeLink("password-reset", url)).toEqual({ status: "invalid" });
  });
});
