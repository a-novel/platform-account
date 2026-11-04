import {
  AUTHENTICATION_SERVICE_URL,
  DOWNTIME_URL,
  HEALTHCHECK_TIMEOUT_MS,
  JSON_KEYS_SERVICE_URL,
  SERVICE_TOKEN_PATH,
  STUDIO_URL,
} from "$app/env/private";

import { type RuntimeConfig, parseRuntimeConfig } from "./runtime-config";

/** Parses the platform's private environment, throwing when it is invalid. */
export function getRuntimeConfig(): RuntimeConfig {
  return parseRuntimeConfig({
    AUTHENTICATION_SERVICE_URL,
    DOWNTIME_URL,
    HEALTHCHECK_TIMEOUT_MS,
    JSON_KEYS_SERVICE_URL,
    SERVICE_TOKEN_PATH,
    STUDIO_URL,
  });
}
