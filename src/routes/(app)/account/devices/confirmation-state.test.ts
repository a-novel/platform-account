import { confirmationParameter, confirmationValue, readConfirmation } from "./confirmation-state";

import { describe, expect, it } from "vitest";

const phoneID = "5a1d9e0c-8b7f-4c2a-b3e4-2f9d6c8a7e10";

describe("readConfirmation", () => {
  it.each([
    [`confirm=${phoneID}`, { kind: "device", id: phoneID }],
    [`confirm=${phoneID.toUpperCase()}`, { kind: "device", id: phoneID.toUpperCase() }],
    ["confirm=others", { kind: "others" }],
    ["", null],
    ["confirm=", null],
    ["confirm=Others", null],
    ["confirm=all", null],
    ["confirm=5a1d9e0c", null],
    [`confirm=${phoneID}x`, null],
    [`confirm=${phoneID}&confirm=others`, null],
  ])("reads ?%s", (query, confirmation) => {
    expect(readConfirmation(new URLSearchParams(query))).toEqual(confirmation);
  });
});

describe("confirmationValue", () => {
  it.each([
    [{ kind: "device", id: phoneID }, phoneID],
    [{ kind: "others" }, "others"],
    [null, null],
  ] as const)("writes %o as %s, which reads back the same", (confirmation, value) => {
    expect(confirmationValue(confirmation)).toBe(value);

    const parameters = new URLSearchParams(value ? { [confirmationParameter]: value } : {});
    expect(readConfirmation(parameters)).toEqual(confirmation);
  });
});
