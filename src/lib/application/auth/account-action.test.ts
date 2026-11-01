import { createAccountModel, mergeAccountAction } from "./account-action";

import { describe, expect, it } from "vitest";

const ready = createAccountModel(
  {
    status: "ready",
    userId: "140f24ee-1531-4a9d-ace8-20b38e1b21bc",
    roles: ["auth:user"],
    accessExpiresAt: "soon",
    refreshExpiresAt: "later",
  },
  { status: "ready", email: "creator@example.com" }
);

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

  it("preserves action feedback when the session recap is unavailable", () => {
    const unavailable = createAccountModel(
      { status: "error", feedback: "sessionUnavailable" },
      { status: "unavailable" }
    );
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
