import type { ShellApps, ShellSession, ShellViewModel } from "#lib/application/shell/types.js";
import { type AuthenticationEvent, getAuthenticationContext } from "#lib/server/auth/context.js";
import type { ResolvedSession } from "#lib/server/auth/session.js";
import { readPlatformDowntime } from "#lib/server/downtime.js";
import { getProfileContext, summarizeProfile } from "#lib/server/profile/context.js";
import { getRuntimeConfig } from "#lib/server/runtime-config.server.js";

import { type AccountDisplay, accountDisplayFromHandle } from "./account-display";

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

/**
 * The rail destination each page belongs to. The account pages are where a signed-in visitor's home leads, and
 * privacy is one of their tabs.
 */
const navigation: Record<string, ShellViewModel["activeNavigation"]> = {
  "/": "home",
  "/account": "home",
  "/account/devices": "home",
  "/account/privacy": "home",
};

type ShellEvent = AuthenticationEvent & Pick<RequestEvent, "locals">;

/** Loads the shell's navigation state, app list, session display and page authorization. */
export const load = async (event: ShellEvent) => {
  const session = await readShellSession(event);

  return {
    activeNavigation: navigation[event.url.pathname] ?? null,
    apps: readApps(),
    session,
    authorization: shellAuthorization[session.status],
  };
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

  const display = resolved.identityHandle ? accountDisplayFromHandle(resolved.identityHandle) : fallbackDisplay(event);
  return { status: "authenticated", ...display, picture: await readPicture(event, resolved.accessToken) };
}

/** Names an account whose email handle the shell has not kept. */
function fallbackDisplay(event: ShellEvent): AccountDisplay {
  const t = event.locals.i18n.getFixedT(event.locals.locale, "common");
  return { displayName: t("shell.accountFallback"), initials: "A" };
}

/** Reads the address of the visitor's picture. Without the profile service, the shell shows initials. */
async function readPicture(event: ShellEvent, accessToken: string): Promise<string | undefined> {
  try {
    return summarizeProfile(await getProfileContext(event).self(accessToken)).picture;
  } catch {
    return undefined;
  }
}

/** Reads the visitor's session, treating a server that cannot reach Authentication as an outage. */
async function currentSession(event: AuthenticationEvent): Promise<ResolvedSession> {
  try {
    return await getAuthenticationContext(event).session.current();
  } catch {
    return { status: "unavailable" };
  }
}
