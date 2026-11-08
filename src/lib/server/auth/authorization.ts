import { loginHref } from "#lib/application/auth/navigation.js";

import { downtimeError, refuseDuringDowntime } from "../downtime";
import { type AuthenticationEvent, getAuthenticationContext } from "./context";
import { type AuthenticatedSession, AuthenticationDowntimeError } from "./session";

import { error, redirect } from "@sveltejs/kit";

/**
 * Verifies each protected load or mutation independently. SDK clients and tokens remain server-only.
 * Optional rules restrict a verified account. An authentication outage never becomes anonymous access.
 */
export async function requireAuthorization(
  event: AuthenticationEvent,
  when: (session: AuthenticatedSession) => boolean = () => true
) {
  await refuseDuringDowntime();

  const { authentication, session } = await authenticate(event);
  if (!session) {
    // A page asked for with an authentication dialog renders locked under it, so the refusal stops there.
    if (isRead(event.request) && event.url.searchParams.has("auth")) error(401, "Log in to continue");
    // A load repeats its GET at the login with a 307; a form action's POST becomes a GET with a 303.
    redirect(isRead(event.request) ? 307 : 303, loginHref(event.url.pathname + event.url.search));
  }
  if (!when(session)) error(403, "Access denied");
  return { authentication, session };
}

function isRead({ method }: Request): boolean {
  return method === "GET" || method === "HEAD";
}

/** Resolves the visitor's session, or fails with the 503 an unreachable authentication service warrants. */
async function authenticate(event: AuthenticationEvent) {
  try {
    const authentication = getAuthenticationContext(event);
    return { authentication, session: await authentication.session.authenticated() };
  } catch (cause) {
    if (cause instanceof AuthenticationDowntimeError) downtimeError();
    error(503, "Authentication unavailable");
  }
}
