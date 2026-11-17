import { getRuntimeConfig } from "#lib/server/runtime-config.server.js";
import { serviceFetch } from "#lib/server/service-fetch.js";

import type { RequestHandler } from "./$types";

import { type HealthServiceConfig, aggregateHealth } from "@a-novel-kit/nodelib-server";

import { json } from "@sveltejs/kit";

/** Probes the platform's service registry and preserves each service-owned dependency map. */
export const GET: RequestHandler = async ({ fetch }) => {
  // Probes prove the platform's identity to each service like any call, but are made for no visitor.
  const probe =
    (service: ServiceUrl, path: string, token?: TokenPath): (() => HealthServiceConfig) =>
    () => {
      const config = getRuntimeConfig();
      return {
        timeoutMs: config.healthcheckTimeoutMs,
        url: new URL(path, `${config[service]}/`),
        fetch: serviceFetch({ serviceTokenPath: token && config[token] }, fetch),
      };
    };

  const health = await aggregateHealth({
    config: {
      authentication: probe("authenticationServiceUrl", "v2/healthcheck", "serviceTokenPath"),
      // JSON keys' API is public, so its probe carries no token.
      jsonKeys: probe("jsonKeysServiceUrl", "v2/healthcheck"),
      profile: probe("profileServiceUrl", "v1/healthcheck", "profileServiceTokenPath"),
    },
    fetch,
  });

  return json(health, {
    headers: {
      "cache-control": "no-store",
    },
    status: health.status === "up" ? 200 : 503,
  });
};

type ServiceUrl = "authenticationServiceUrl" | "jsonKeysServiceUrl" | "profileServiceUrl";
type TokenPath = "serviceTokenPath" | "profileServiceTokenPath";
