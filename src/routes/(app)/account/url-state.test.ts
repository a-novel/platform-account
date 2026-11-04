import { addressBar, dialogUrl, localHref } from "./url-state";

import { afterEach, describe, expect, it, vi } from "vitest";

describe("addressBar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the request's URL while the server renders", () => {
    const request = new URL("https://account.test/account?edit=email");
    const url = addressBar(request);

    expect(url.href).toBe(request.href);
    expect(url).not.toBe(request);
  });

  it("reads the address bar in the browser, which shallow routing changes without the page's URL", () => {
    vi.stubGlobal("window", { location: { href: "https://account.test/account/devices?confirm=others#list" } });

    expect(addressBar(new URL("https://account.test/account/devices")).href).toBe(
      "https://account.test/account/devices?confirm=others#list"
    );
  });
});

describe("dialogUrl", () => {
  const url = new URL("https://account.test/account?menu=open&edit=password&/password#email");

  it.each([
    ["opens", "email", "/account?menu=open&edit=email#email"],
    ["closes", null, "/account?menu=open#email"],
  ])("%s a dialog and drops the form action it was submitted with", (_, value, expected) => {
    expect(localHref(dialogUrl(url, "edit", value))).toBe(expected);
    expect(url.href).toBe("https://account.test/account?menu=open&edit=password&/password#email");
  });
});

describe("localHref", () => {
  it("keeps the path, the query and the fragment, never the origin", () => {
    expect(localHref(new URL("https://account.test/account/devices?confirm=others#list"))).toBe(
      "/account/devices?confirm=others#list"
    );
  });
});
