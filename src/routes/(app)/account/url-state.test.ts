import { dialogUrl, localHref } from "./url-state";

import { describe, expect, it } from "vitest";

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
