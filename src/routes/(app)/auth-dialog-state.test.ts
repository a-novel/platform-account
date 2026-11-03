import { normalizeAuthUrl, readAuthView, withAuthView } from "./auth-dialog-state";

import { describe, expect, it } from "vitest";

describe("authentication URL state", () => {
  it("leaves valid login return parameters in their original order", () => {
    const source = new URL("https://account.example.test/?auth=login&returnTo=%2Faccount%3Fpanel%3Demail");
    expect(normalizeAuthUrl(source).href).toBe(source.href);
  });

  it.each(["login", "register", "reset"] as const)("round-trips the %s view", (view) => {
    const source = new URL("https://account.example.test/work?document=42#selection");
    const encoded = withAuthView(source, view);

    expect(readAuthView(encoded.searchParams)).toBe(view);
    expect(encoded.searchParams.get("document")).toBe("42");
    expect(encoded.hash).toBe("#selection");
    expect(source.searchParams.has("auth")).toBe(false);
  });

  it("removes authentication state without changing unrelated parameters", () => {
    const source = new URL("https://account.example.test/?auth=login&panel=outline");

    expect(withAuthView(source, null).href).toBe("https://account.example.test/?panel=outline");
  });

  it.each(["unknown", "", "login&auth=register"])("normalizes invalid state %s to closed", (query) => {
    const source = new URL(`https://account.example.test/?keep=yes&auth=${query}`);
    const normalized = normalizeAuthUrl(source);

    expect(readAuthView(source.searchParams)).toBeNull();
    expect(normalized.href).toBe("https://account.example.test/?keep=yes");
  });
});
