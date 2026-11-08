import { loginHref, returnsToAuthorization, safeReturnTo } from "./navigation";

import { describe, expect, it } from "vitest";

describe("authentication navigation", () => {
  const returnDestinations = [
    ["/account?panel=password#change", "/account?panel=password#change"],
    ["/account?query=two%20words", "/account?query=two+words"],
    ["/account?auth=login&returnTo=%2Faccount&panel=email", "/account?panel=email"],
    ["/account?/password&panel=email", "/account?panel=email"],
    ["/?auth=login&returnTo=%2F", "/"],
    ["https://attacker.invalid/account", "/"],
    ["//attacker.invalid/account", "/"],
    ["/%2fattacker.invalid", "/"],
    ["/%2e%2e//attacker.invalid", "/"],
    ["/%5cattacker.invalid", "/"],
    ["/%0d%0aLocation:evil", "/"],
    ["/%zz", "/"],
    ["javascript:alert(1)", "/"],
    [null, "/"],
  ];

  it.each(returnDestinations)("sanitizes %s", (value, expected) => {
    expect(safeReturnTo(value)).toBe(expected);
  });

  const authorizationReturns = [
    ["/authorize?response_type=code&client_id=studio", true],
    ["/authorize", true],
    ["/authorize/other", false],
    ["/account?next=/authorize", false],
    ["//attacker.invalid/authorize", false],
    [null, false],
  ] as const;

  it.each(authorizationReturns)(
    "tells whether a login returning to %s continues an authorization request",
    (value, expected) => {
      expect(returnsToAuthorization(value)).toBe(expected);
    }
  );

  it("opens the login dialog over the account page with the safe target encoded once", () => {
    expect(loginHref("/account?panel=email")).toBe("/account?auth=login&returnTo=%2Faccount%3Fpanel%3Demail");
  });
});
