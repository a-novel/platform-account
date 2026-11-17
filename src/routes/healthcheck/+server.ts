import { getRuntimeConfig } from "#lib/server/runtime-config.server.js";
import { serviceFetch } from "#lib/server/service-fetch.js";

import type { RequestHandler } from "./$types";

import { aggregateHealth } from "@a-novel-kit/nodelib-server";

import { json } from "@sveltejs/kit";

/** Probes the platform's service registry and preserves each service-owned dependency map. */
export const GET: RequestHandler = async ({ fetch }) => {
  const health = await aggregateHealth({
    config: {
      authentication: probe("authenticationServiceUrl", "v2/healthcheck"),
      jsonKeys: probe("jsonKeysServiceUrl", "v2/healthcheck"),
      profile: probe("profileServiceUrl", "v1/healthcheck"),
    },
    // Probes prove the platform's identity to each service like any call, but are made for no
    // visitor. JSON keys' API is public, so its probe carries no token.
    fetch: async (input, init) => await serviceFetch(probeIdentity(String(input)), fetch)(input, init),
  });

  return json(health, {
    headers: {
      "cache-control": "no-store",
    },
    status: health.status === "up" ? 200 : 503,
  });
};

/** Configures the probe of one service's health route, read once the probes run. */
function probe(service: "authenticationServiceUrl" | "jsonKeysServiceUrl" | "profileServiceUrl", path: string) {
  return () => {
    const config = getRuntimeConfig();
    return { timeoutMs: config.healthcheckTimeoutMs, url: new URL(path, `${config[service]}/`) };
  };
}

/** Picks the service token of the service a probe calls. */
function probeIdentity(url: string) {
  const config = getRuntimeConfig();
  if (url.startsWith(`${config.authenticationServiceUrl}/`)) return { serviceTokenPath: config.serviceTokenPath };
  if (url.startsWith(`${config.profileServiceUrl}/`)) return { serviceTokenPath: config.profileServiceTokenPath };
  return {};
}
