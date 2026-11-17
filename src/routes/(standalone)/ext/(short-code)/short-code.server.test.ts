import { readShortCodeModel } from "./short-code.server";

import { describe, expect, it } from "vitest";

describe("readShortCodeModel", () => {
  it("supports clean shareable result URLs", () => {
    expect(
      readShortCodeModel("password-reset", new URL("https://account.test/ext/password/reset?result=success"))
    ).toEqual({
      journey: "password-reset",
      state: { status: "success", feedback: "passwordReset" },
    });
  });
});
