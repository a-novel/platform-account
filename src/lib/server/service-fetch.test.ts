import { serviceFetch } from "./service-fetch";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, onTestFinished, vi } from "vitest";

function headersOf(base: ReturnType<typeof vi.fn>, call = 0): Headers {
  return new Headers((base.mock.calls[call]?.[1] as RequestInit | undefined)?.headers);
}

describe("serviceFetch", () => {
  it("names the visitor and keeps the request's own headers", async () => {
    const base = vi.fn(async () => new Response("ok"));

    await serviceFetch({ visitorAddress: "192.0.2.1" }, base)("https://authentication.test/v2/session", {
      headers: { Authorization: "Bearer user" },
    });

    expect(headersOf(base).get("X-Client-IP")).toBe("192.0.2.1");
    expect(headersOf(base).get("Authorization")).toBe("Bearer user");
    expect(headersOf(base).has("X-Service-Authorization")).toBe(false);
  });

  it("names the visitor's device from their browser and the load balancer's estimated place", async () => {
    const base = vi.fn(async () => new Response("ok"));
    const visitorRequest = new Request("https://account.test/?auth=login", {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0",
        "X-Client-Region": "FR",
        "X-Client-City": "Lyon",
        Cookie: "__Host-account_access_token=private-access",
      },
    });

    await serviceFetch({ visitorAddress: "192.0.2.1", visitorRequest }, base)("https://authentication.test/v2/session");

    // The visitor's cookies stay with the platform.
    expect(Object.fromEntries(headersOf(base))).toEqual({
      "x-client-ip": "192.0.2.1",
      "x-client-user-agent": "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0",
      "x-client-region": "FR",
      "x-client-city": "Lyon",
    });
  });

  it("leaves out the device headers the visitor's request lacks", async () => {
    const base = vi.fn(async () => new Response("ok"));
    const visitorRequest = new Request("https://account.test/", { headers: { "X-Client-Region": "FR" } });

    await serviceFetch({ visitorAddress: "192.0.2.1", visitorRequest }, base)("https://authentication.test/v2/session");

    expect(Object.fromEntries(headersOf(base))).toEqual({ "x-client-ip": "192.0.2.1", "x-client-region": "FR" });
  });

  it("sends the current projected service token", async () => {
    const directory = await mkdtemp(join(tmpdir(), "service-token-"));
    onTestFinished(async () => await rm(directory, { recursive: true }));
    const tokenPath = join(directory, "token");
    const base = vi.fn(async () => new Response("ok"));
    const send = serviceFetch({ serviceTokenPath: tokenPath }, base);

    await writeFile(tokenPath, "service-token");
    await send("https://authentication.test/v2/healthcheck");
    await writeFile(tokenPath, "rotated-service-token");
    await send("https://authentication.test/v2/healthcheck");

    expect(headersOf(base, 0).get("X-Service-Authorization")).toBe("service-token");
    expect(headersOf(base, 1).get("X-Service-Authorization")).toBe("rotated-service-token");
    expect(headersOf(base, 1).has("X-Client-IP")).toBe(false);
  });
});
