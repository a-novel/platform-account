import { parseRuntimeConfig } from "./runtime-config";

import { describe, expect, it } from "vitest";

const services = {
  AUTHENTICATION_SERVICE_URL: "http://authentication:8080",
  JSON_KEYS_SERVICE_URL: "http://json-keys:8080",
  PROFILE_SERVICE_URL: "http://profile:8080",
  STUDIO_URL: "http://studio",
};

describe("parseRuntimeConfig", () => {
  it("normalizes a valid service URL and default timeout", () => {
    expect(
      parseRuntimeConfig({
        AUTHENTICATION_SERVICE_URL: "https://authentication.example.test/",
        JSON_KEYS_SERVICE_URL: "https://json-keys.example.test/",
        PROFILE_SERVICE_URL: "https://profile.example.test/",
        STUDIO_URL: "https://studio.example.test",
      })
    ).toEqual({
      authenticationServiceUrl: "https://authentication.example.test",
      downtimeUrl: "https://raw.githubusercontent.com/a-novel/infra/downtime/downtime.json",
      healthcheckTimeoutMs: 2000,
      jsonKeysServiceUrl: "https://json-keys.example.test",
      profileServiceUrl: "https://profile.example.test",
      studioUrl: "https://studio.example.test",
    });
  });

  it("accepts an explicit bounded timeout", () => {
    expect(
      parseRuntimeConfig({
        AUTHENTICATION_SERVICE_URL: "http://authentication:8080",
        DOWNTIME_URL: "http://downtime.test/downtime.json",
        HEALTHCHECK_TIMEOUT_MS: "750",
        JSON_KEYS_SERVICE_URL: "http://json-keys:8080",
        PROFILE_SERVICE_TOKEN_PATH: "/var/run/secrets/profile/token",
        PROFILE_SERVICE_URL: "http://profile:8080",
        SERVICE_TOKEN_PATH: "/var/run/secrets/authentication/token",
        STUDIO_URL: "http://localhost:5173",
      })
    ).toEqual({
      authenticationServiceUrl: "http://authentication:8080",
      downtimeUrl: "http://downtime.test/downtime.json",
      healthcheckTimeoutMs: 750,
      jsonKeysServiceUrl: "http://json-keys:8080",
      profileServiceUrl: "http://profile:8080",
      profileServiceTokenPath: "/var/run/secrets/profile/token",
      serviceTokenPath: "/var/run/secrets/authentication/token",
      studioUrl: "http://localhost:5173",
    });
  });

  const invalidEnvironments = [
    [{ ...services, AUTHENTICATION_SERVICE_URL: undefined }, "AUTHENTICATION_SERVICE_URL"],
    [{ ...services, AUTHENTICATION_SERVICE_URL: "postgres://database" }, "AUTHENTICATION_SERVICE_URL"],
    [{ ...services, JSON_KEYS_SERVICE_URL: undefined }, "JSON_KEYS_SERVICE_URL"],
    [{ ...services, PROFILE_SERVICE_URL: "ftp://profile" }, "PROFILE_SERVICE_URL"],
    [{ ...services, STUDIO_URL: "javascript:alert(1)" }, "STUDIO_URL"],
    [{ ...services, HEALTHCHECK_TIMEOUT_MS: "99" }, "HEALTHCHECK_TIMEOUT_MS"],
  ] as const;

  it.each(invalidEnvironments)("rejects invalid environment without echoing values", (environment, field) => {
    expect(() => parseRuntimeConfig(environment)).toThrow(`Invalid server environment: ${field}`);
  });
});
