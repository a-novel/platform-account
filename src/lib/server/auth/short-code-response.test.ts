import { secureShortCodeResponse } from "./short-code-response";

import { describe, expect, it } from "vitest";

describe("secureShortCodeResponse", () => {
  it("prevents caching, indexing, and code-bearing referrers while allowing native form origins", () => {
    const response = secureShortCodeResponse(
      new Response("completion", {
        headers: { "content-type": "text/plain" },
      })
    );

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("content-type")).toBe("text/plain");
  });
});
