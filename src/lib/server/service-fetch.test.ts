import { serviceFetch } from "./service-fetch";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";

function headersOf(base: ReturnType<typeof vi.fn>, call = 0): Headers {
  return new Headers((base.mock.calls[call]?.[1] as RequestInit | undefined)?.headers);
}

describe("serviceFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("names the visitor and keeps the request's own headers", async () => {
    const base = vi.fn(async () => new Response("ok"));

    await serviceFetch({ visitorAddress: "192.0.2.1" }, base)("https://authentication.test/v2/session", {
      headers: { Authorization: "Bearer user" },
    });

    expect(headersOf(base).get("X-Client-IP")).toBe("192.0.2.1");
    expect(headersOf(base).get("Authorization")).toBe("Bearer user");
    expect(headersOf(base).has("X-Serverless-Authorization")).toBe(false);
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

  it("proves the platform's identity once per token lifetime when an audience is set", async () => {
    const metadata = vi.fn(async () => new Response("identity-token"));
    vi.stubGlobal("fetch", metadata);
    const base = vi.fn(async () => new Response("ok"));
    const send = serviceFetch({ audience: "agora-authentication-rest-test" }, base);

    await send("https://authentication.test/v2/healthcheck");
    await send("https://authentication.test/v2/healthcheck");

    expect(headersOf(base, 1).get("X-Serverless-Authorization")).toBe("Bearer identity-token");
    expect(headersOf(base, 1).has("X-Client-IP")).toBe(false);
    expect(metadata).toHaveBeenCalledOnce();
    expect(metadata).toHaveBeenCalledWith(
      expect.stringContaining("audience=agora-authentication-rest-test"),
      expect.objectContaining({ headers: { "Metadata-Flavor": "Google" } })
    );
  });

  it("sends the current projected service token instead of an identity token", async () => {
    const directory = await mkdtemp(join(tmpdir(), "service-token-"));
    onTestFinished(async () => await rm(directory, { recursive: true }));
    const tokenPath = join(directory, "token");
    const metadata = vi.fn(async () => new Response("identity-token"));
    vi.stubGlobal("fetch", metadata);
    const base = vi.fn(async () => new Response("ok"));
    const send = serviceFetch({ audience: "agora-authentication-rest-token", serviceTokenPath: tokenPath }, base);

    await writeFile(tokenPath, "service-token");
    await send("https://authentication.test/v2/healthcheck");
    await writeFile(tokenPath, "rotated-service-token");
    await send("https://authentication.test/v2/healthcheck");

    expect(headersOf(base, 0).get("X-Service-Authorization")).toBe("service-token");
    expect(headersOf(base, 1).get("X-Service-Authorization")).toBe("rotated-service-token");
    expect(headersOf(base, 1).has("X-Serverless-Authorization")).toBe(false);
    expect(metadata).not.toHaveBeenCalled();
  });

  it("retries a failed identity token on the next call", async () => {
    const failure = new Response("metadata server unavailable", { status: 500 });
    const metadata = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(failure)
      .mockResolvedValueOnce(new Response("identity-token"));
    vi.stubGlobal("fetch", metadata);
    const base = vi.fn(async () => new Response("ok"));
    const send = serviceFetch({ audience: "agora-authentication-rest-retry" }, base);

    await expect(send("https://authentication.test/v2/healthcheck")).rejects.toThrow("identity token");
    await send("https://authentication.test/v2/healthcheck");

    expect(failure.bodyUsed).toBe(true);
    expect(base).toHaveBeenCalledOnce();
    expect(headersOf(base).get("X-Serverless-Authorization")).toBe("Bearer identity-token");
  });
});
