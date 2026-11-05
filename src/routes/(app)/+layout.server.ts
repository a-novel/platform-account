import type { ProfileSummary } from "#lib/application/profile/types.js";
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
 * privacy is one of their tabs. The public Privacy page serves logged-out visitors.
 */
const navigation: Record<string, ShellViewModel["activeNavigation"]> = {
  "/": "home",
  "/account": "home",
  "/account/devices": "home",
  "/account/privacy": "home",
  "/privacy": "privacy",
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

  const { username, picture } = await readProfile(event, resolved.accessToken);
  const display = resolved.identityHandle
    ? accountDisplayFromHandle(resolved.identityHandle, username)
    : fallbackDisplay(event, username);
  return { status: "authenticated", ...display, picture };
}

/** Names an account whose email handle the shell has not kept: by its username, else generically. */
function fallbackDisplay(event: ShellEvent, username?: string): AccountDisplay {
  const t = event.locals.i18n.getFixedT(event.locals.locale, "common");
  return { displayName: username ?? t("shell.accountFallback"), initials: "A" };
}

/**
 * Reads the visitor's username and picture address. Without the profile service, the shell names the
 * account by its email handle and shows initials.
 */
async function readProfile(event: ShellEvent, accessToken: string): Promise<ProfileSummary> {
  try {
    return summarizeProfile(await getProfileContext(event).self(accessToken));
  } catch {
    return {};
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
