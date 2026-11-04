import { createInformationModel, mergeAccountAction } from "./account-action";

import { describe, expect, it } from "vitest";

const ready = createInformationModel({ status: "ready", email: "creator@example.com", locationConsent: false }, null);

describe("mergeAccountAction", () => {
  it("overlays only the password action state", () => {
    expect(
      mergeAccountAction(ready, {
        accountAction: {
          kind: "password",
          state: { status: "success", feedback: "passwordChanged" },
        },
      })
    ).toEqual({
      ...ready,
      passwordState: { status: "success", feedback: "passwordChanged" },
    });
  });

  it("overlays only the email action state", () => {
    expect(
      mergeAccountAction(ready, {
        accountAction: {
          kind: "email",
          state: { status: "pending-email" },
        },
      })
    ).toEqual({
      ...ready,
      emailState: { status: "pending-email" },
    });
  });

  it.each([
    ["no action", null],
    ["text", "accountAction"],
    ["another form's result", { authentication: { journey: "login", state: { status: "ready" } } }],
  ])("ignores %s", (_, data) => {
    expect(mergeAccountAction(ready, data)).toBe(ready);
  });

  it("preserves action feedback when the credentials are unavailable", () => {
    const unavailable = createInformationModel({ status: "unavailable" }, null);
    expect(
      mergeAccountAction(unavailable, {
        accountAction: {
          kind: "password",
          state: { status: "success", feedback: "passwordChanged" },
        },
      })
    ).toEqual({ ...unavailable, passwordState: { status: "success", feedback: "passwordChanged" } });
  });
});
