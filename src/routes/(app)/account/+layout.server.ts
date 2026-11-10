import type { AccountCredentialsState, AccountSummaryState } from "#lib/application/auth/types.js";
import type { ProfileState } from "#lib/application/profile/types.js";
import { requireAuthorization } from "#lib/server/auth/authorization.js";
import type { AuthenticationEvent } from "#lib/server/auth/context.js";
import { readTokenExpiry } from "#lib/server/auth/session.js";
import { type ProfileEvent, getProfileContext, summarizeProfile } from "#lib/server/profile/context.js";

import { accountData } from "../dependencies";

import { type AuthenticationApi, credentialsGetSelf } from "@a-novel/service-authentication-rest";

import type { ServerLoadEvent } from "@sveltejs/kit";
import { isHttpError, isRedirect } from "@sveltejs/kit";

/** Reads the account's email, its pending change and its location consent. A failure hides only them. */
async function loadCredentials(
  api: AuthenticationApi,
  accessToken: string,
  dates: Intl.DateTimeFormat
): Promise<AccountCredentialsState> {
  try {
    const { email, pendingEmail, locationConsent } = await credentialsGetSelf(api, accessToken);
    return {
      status: "ready",
      email,
      pendingEmail: pendingEmail && { email: pendingEmail.email, expiresAt: dates.format(pendingEmail.expiresAt) },
      locationConsent,
    };
  } catch {
    // The trace records the failed call.
    return { status: "unavailable" };
  }
}

/** Reads the account's public profile. A failure hides only it. */
async function loadProfile(event: ProfileEvent, accessToken: string): Promise<ProfileState> {
  try {
    return { status: "ready", ...summarizeProfile(await getProfileContext(event).self(accessToken)) };
  } catch {
    // The trace records the failed call.
    return { status: "unavailable" };
  }
}

/**
 * Loads the header, the credentials and the public profile every account tab reads. An authentication
 * outage still renders the tabs.
 */
export const load = async (event: AuthenticationEvent & Pick<ServerLoadEvent, "locals" | "depends">) => {
  event.depends(accountData);
  const dates = new Intl.DateTimeFormat(event.locals.locale, { dateStyle: "medium", timeStyle: "short" });

  try {
    const { authentication, session } = await requireAuthorization(event);
    const [credentials, profile] = await Promise.all([
      loadCredentials(authentication.api, session.accessToken, dates),
      loadProfile(event, session.accessToken),
    ]);
    // The shell names the visitor from a cookie, which an email change on another device leaves stale.
    if (credentials.status === "ready") authentication.session.rememberIdentity(credentials.email);

    // A session holds until its refresh token expires: the visitor logs in again only then.
    const refreshExpiry = session.refreshToken ? readTokenExpiry(session.refreshToken) : null;
    const summary: AccountSummaryState = {
      status: "ready",
      roles: session.claims.roles ?? [],
      email: credentials.status === "ready" ? credentials.email : undefined,
      loggedInUntil: refreshExpiry ? dates.format(refreshExpiry) : undefined,
      profile: profile.status === "ready" ? { username: profile.username, picture: profile.picture } : undefined,
    };

    return { authorization: "allowed" as const, summary, credentials, profile };
  } catch (error) {
    // Redirects, refusals and planned downtimes render their own pages. Any other failure keeps the tabs.
    if (isRedirect(error) || isHttpError(error, 401) || isHttpError(error, 403)) throw error;
    if (isHttpError(error, 503) && error.body.downtime) throw error;

    const summary: AccountSummaryState = { status: "loading" };
    const credentials: AccountCredentialsState = { status: "unavailable" };
    const profile: ProfileState = { status: "unavailable" };
    return { authorization: "unavailable" as const, summary, credentials, profile };
  }
};
