import { readDeviceName } from "./user-agent";

import { describe, expect, it } from "vitest";

describe("readDeviceName", () => {
  it.each([
    {
      name: "Firefox on Linux",
      userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0",
      expected: { browser: "Firefox", system: "Linux", form: "desktop" },
    },
    {
      name: "Edge on Windows, which also names Chrome and Safari",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      expected: { browser: "Edge", system: "Windows", form: "desktop" },
    },
    {
      name: "Safari on an iPhone",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
      expected: { browser: "Safari", system: "iOS", form: "phone" },
    },
    {
      name: "Chrome on an Android phone, which also names Linux",
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
      expected: { browser: "Chrome", system: "Android", form: "phone" },
    },
    {
      name: "Chrome on an Android tablet",
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      expected: { browser: "Chrome", system: "Android", form: "tablet" },
    },
    { name: "an empty User-Agent", userAgent: "", expected: { form: "desktop" } },
    { name: "a script", userAgent: "curl/8.11.0", expected: { form: "desktop" } },
  ])("reads $name", ({ userAgent, expected }) => {
    expect(readDeviceName(userAgent)).toEqual({ browser: undefined, system: undefined, ...expected });
  });
});
