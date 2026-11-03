import type { AccountCredentialsState, AccountSummaryState } from "#lib/application/auth/types.js";
import { requireAuthorization } from "#lib/server/auth/authorization.js";
import type { AuthenticationEvent } from "#lib/server/auth/context.js";
import { readTokenExpiry } from "#lib/server/auth/session.js";

import { type AuthenticationApi, credentialsGetSelf } from "@a-novel/service-authentication-rest";

import type { RequestEvent } from "@sveltejs/kit";
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

/** Loads the header and the credentials every account tab reads. An authentication outage still renders the tabs. */
export const load = async (event: AuthenticationEvent & Pick<RequestEvent, "locals">) => {
  const dates = new Intl.DateTimeFormat(event.locals.locale, { dateStyle: "medium", timeStyle: "short" });

  try {
    const { authentication, session } = await requireAuthorization(event);
    const credentials = await loadCredentials(authentication.api, session.accessToken, dates);
    // The shell names the visitor from a cookie, which an email change on another device leaves stale.
    if (credentials.status === "ready") authentication.session.rememberIdentity(credentials.email);

    // A session holds until its refresh token expires: the visitor logs in again only then.
    const refreshExpiry = session.refreshToken ? readTokenExpiry(session.refreshToken) : null;
    const summary: AccountSummaryState = {
      status: "ready",
      roles: session.claims.roles ?? [],
      email: credentials.status === "ready" ? credentials.email : undefined,
      loggedInUntil: refreshExpiry ? dates.format(refreshExpiry) : undefined,
    };

    return { authorization: "allowed" as const, summary, credentials };
  } catch (error) {
    // Redirects, refusals and planned downtimes render their own pages. Any other failure keeps the tabs.
    if (isRedirect(error) || isHttpError(error, 403) || (isHttpError(error, 503) && error.body.downtime)) throw error;

    const summary: AccountSummaryState = { status: "error", feedback: "sessionUnavailable" };
    const credentials: AccountCredentialsState = { status: "unavailable" };
    return { authorization: "unavailable" as const, summary, credentials };
  }
};
