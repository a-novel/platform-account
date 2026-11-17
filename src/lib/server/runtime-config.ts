import {
  type EnvironmentOutput,
  type EnvironmentSource,
  environmentHttpUrl,
  environmentInteger,
  environmentOptional,
  parseEnvironment,
} from "@a-novel-kit/nodelib-server";

/** The public planned downtime document operators publish from infra. */
const defaultDowntimeUrl = "https://raw.githubusercontent.com/a-novel/infra/downtime/downtime.json";

const runtimeEnvironmentSchema = {
  authenticationServiceUrl: environmentHttpUrl("AUTHENTICATION_SERVICE_URL"),
  downtimeUrl: environmentHttpUrl("DOWNTIME_URL", { defaultValue: defaultDowntimeUrl }),
  healthcheckTimeoutMs: environmentInteger("HEALTHCHECK_TIMEOUT_MS", {
    defaultValue: 2000,
    maximum: 10_000,
    minimum: 100,
  }),
  jsonKeysServiceUrl: environmentHttpUrl("JSON_KEYS_SERVICE_URL"),
  /** The file of the projected service token the platform sends to the profile service. Unset outside Kubernetes. */
  profileServiceTokenPath: environmentOptional("PROFILE_SERVICE_TOKEN_PATH"),
  profileServiceUrl: environmentHttpUrl("PROFILE_SERVICE_URL"),
  /** The file of the projected service token the platform sends to Authentication. Unset outside Kubernetes. */
  serviceTokenPath: environmentOptional("SERVICE_TOKEN_PATH"),
  studioUrl: environmentHttpUrl("STUDIO_URL"),
} as const;

/** RuntimeConfig contains the platform's private server settings. */
export type RuntimeConfig = EnvironmentOutput<typeof runtimeEnvironmentSchema>;

/** Parses the platform's environment variables without retaining invalid values. */
export function parseRuntimeConfig(environment: EnvironmentSource): RuntimeConfig {
  return parseEnvironment(environment, runtimeEnvironmentSchema);
}
