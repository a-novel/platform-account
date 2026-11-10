import { devicePageUrl, pageOf, readPages } from "./device-pages";

import { describe, expect, it } from "vitest";

describe("readPages", () => {
  it("reads each list's page", () => {
    expect(readPages(new URLSearchParams("page=3&loggedOutPage=2"))).toEqual({ active: 3, loggedOut: 2 });
  });

  it.each(["", "page=0", "page=-1", "page=1.5", "page=two"])("shows the first page for %j", (search) => {
    expect(readPages(new URLSearchParams(search)).active).toBe(1);
  });
});

describe("devicePageUrl", () => {
  const url = new URL("https://account.test/account/devices?page=2&confirm=others&/logoutDevice");

  it("sets one list's page and keeps the rest", () => {
    const next = devicePageUrl(url, "loggedOut", 4);

    expect(next.searchParams.get("loggedOutPage")).toBe("4");
    expect(next.searchParams.get("page")).toBe("2");
    expect(next.searchParams.get("confirm")).toBe("others");
  });

  it("leaves no parameter on the first page", () => {
    expect(devicePageUrl(url, "active", 1).searchParams.has("page")).toBe(false);
  });

  it("drops a form action's name", () => {
    expect(devicePageUrl(url, "active", 3).search).not.toContain("logoutDevice");
  });
});

describe("pageOf", () => {
  const devices = Array.from({ length: 23 }, (_, index) => index);

  it("cuts ten devices per page", () => {
    expect(pageOf(devices, 2)).toEqual({ items: devices.slice(10, 20), page: 2, totalPages: 3 });
  });

  it("shows the last page for a page past the end", () => {
    expect(pageOf(devices, 9)).toEqual({ items: devices.slice(20), page: 3, totalPages: 3 });
  });

  it("counts one page for an empty list", () => {
    expect(pageOf([], 1)).toEqual({ items: [], page: 1, totalPages: 1 });
  });
});
