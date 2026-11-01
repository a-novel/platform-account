import { parseRuntimeConfig } from "./runtime-config";

import { describe, expect, it } from "vitest";

describe("parseRuntimeConfig", () => {
  it("normalizes a valid service URL and default timeout", () => {
    expect(
      parseRuntimeConfig({
        AUTHENTICATION_SERVICE_URL: "https://authentication.example.test/",
        STUDIO_URL: "https://studio.example.test",
      })
    ).toEqual({
      authenticationServiceUrl: "https://authentication.example.test",
      downtimeUrl: "https://raw.githubusercontent.com/a-novel/infra/downtime/downtime.json",
      healthcheckTimeoutMs: 2000,
      studioUrl: "https://studio.example.test",
    });
  });

  it("accepts an explicit bounded timeout", () => {
    expect(
      parseRuntimeConfig({
        AUTHENTICATION_SERVICE_URL: "http://authentication:8080",
        DOWNTIME_URL: "http://downtime.test/downtime.json",
        HEALTHCHECK_TIMEOUT_MS: "750",
        STUDIO_URL: "http://localhost:5173",
      })
    ).toEqual({
      authenticationServiceUrl: "http://authentication:8080",
      downtimeUrl: "http://downtime.test/downtime.json",
      healthcheckTimeoutMs: 750,
      studioUrl: "http://localhost:5173",
    });
  });

  const invalidEnvironments = [
    [{}, "AUTHENTICATION_SERVICE_URL"],
    [{ AUTHENTICATION_SERVICE_URL: "postgres://database" }, "AUTHENTICATION_SERVICE_URL"],
    [{ AUTHENTICATION_SERVICE_URL: "http://authentication:8080", STUDIO_URL: "javascript:alert(1)" }, "STUDIO_URL"],
    [
      {
        AUTHENTICATION_SERVICE_URL: "http://authentication:8080",
        HEALTHCHECK_TIMEOUT_MS: "99",
        STUDIO_URL: "http://studio",
      },
      "HEALTHCHECK_TIMEOUT_MS",
    ],
  ] as const;

  it.each(invalidEnvironments)("rejects invalid environment without echoing values", (environment, field) => {
    expect(() => parseRuntimeConfig(environment)).toThrow(`Invalid server environment: ${field}`);
  });
});
