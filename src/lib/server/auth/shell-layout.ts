import { accountDisplayFromHandle } from "#lib/application/shell/account-display.js";
import type { ShellApps, ShellSession } from "#lib/application/shell/types.js";

import { readPlatformDowntime } from "../downtime";
import { getRuntimeConfig } from "../runtime-config.server";
import { type AuthenticationEvent, getAuthenticationContext } from "./context";
import type { ResolvedSession } from "./session";

import { isDowntimeStarted } from "@a-novel-kit/nodelib-server";
import type { AuthorizationStatus } from "@a-novel-kit/uikit/authorization";

import type { RequestEvent } from "@sveltejs/kit";

/** The page authorization each shell session grants. */
const shellAuthorization = {
  anonymous: "anonymous",
  loading: "anonymous",
  error: "unavailable",
  downtime: "unavailable",
  authenticated: "allowed",
} as const satisfies Record<ShellSession["status"], AuthorizationStatus>;

type ShellEvent = AuthenticationEvent & Pick<RequestEvent, "locals">;

/** Loads the shell's app list, session display and page authorization. */
export const loadShell = async (event: ShellEvent) => {
  const session = await readShellSession(event);

  return { apps: readApps(), session, authorization: shellAuthorization[session.status] };
};

/**
 * Lists the Agora apps by their sign-in page, which signs the visitor in through this platform's session. A server
 * with an invalid runtime configuration lists none.
 */
function readApps(): ShellApps | null {
  try {
    return { studio: `${getRuntimeConfig().studioUrl}/auth/sign-in` };
  } catch {
    return null;
  }
}

/** Resolves the session the shell shows, exposing only a display identity to the browser. */
async function readShellSession(event: ShellEvent): Promise<ShellSession> {
  // A started downtime stops Authentication, so the shell doesn't ask it for the session.
  if (isDowntimeStarted(await readPlatformDowntime())) return { status: "downtime" };

  const resolved = await currentSession(event);
  if (resolved.status === "downtime") return { status: "downtime" };
  if (resolved.status === "unavailable") return { status: "error" };
  if (resolved.status === "none" || !resolved.claims.userID) return { status: "anonymous" };
  if (resolved.identityHandle) return { status: "authenticated", ...accountDisplayFromHandle(resolved.identityHandle) };

  const t = event.locals.i18n.getFixedT(event.locals.locale, "common");
  return { status: "authenticated", displayName: t("shell.accountFallback"), initials: "A" };
}

/** Reads the visitor's session, treating a server that cannot reach Authentication as an outage. */
async function currentSession(event: AuthenticationEvent): Promise<ResolvedSession> {
  try {
    return await getAuthenticationContext(event).session.current();
  } catch {
    return { status: "unavailable" };
  }
}
