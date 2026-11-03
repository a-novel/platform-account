import { loginHref } from "#lib/application/auth/navigation.js";
import { type AuthenticationEvent, getAuthenticationContext } from "#lib/server/auth/context.js";
import { downtimeError, refuseDuringDowntime } from "#lib/server/downtime.js";

import { HttpError, isDowntimeError, isHttpStatusError } from "@a-novel-kit/nodelib-browser/http";
import {
  OAuthError,
  authorizationCodeCreate,
  authorizationRequestValidate,
} from "@a-novel/service-authentication-rest";

import { error, redirect } from "@sveltejs/kit";

/**
 * Serves an authorization request (RFC 6749 §4.1.1), which a client sent the visitor's browser to. A visitor
 * without a session logs in first and comes back to the same request.
 *
 * Authentication validates every request before anything else. A request it refuses without naming a redirect URI,
 * such as one from an unknown client, shows the error page. Every other outcome, a code or an error, returns to the
 * client's redirect URI.
 */
export async function load(event: AuthenticationEvent): Promise<never> {
  await refuseDuringDowntime();

  const { api, session } = getAuthenticationContext(event);
  const request = event.url.searchParams;
  const login = loginHref(event.url.pathname + event.url.search);

  const { redirect_uri: redirectUri } = await authorizationRequestValidate(api, request).catch((cause: unknown) =>
    refuse(event, cause)
  );

  const account = await session.authenticated().catch((cause: unknown) => abort(event, redirectUri, cause));
  if (!account) redirect(303, login);

  const issued = await authorizationCodeCreate(api, account.accessToken, request).catch((cause: unknown) => {
    if (!isHttpStatusError(cause, 401)) abort(event, redirectUri, cause);

    // The session ended after the platform checked it, so the visitor logs in again.
    session.clear();
    redirect(303, login);
  });
  respond(event, issued.redirect_uri, { code: issued.code });
}

/** Fails a request Authentication refused or could not check. Only a redirect URI it names receives the error. */
function refuse(event: AuthenticationEvent, cause: unknown): never {
  if (!(cause instanceof OAuthError)) {
    if (isDowntimeError(cause)) downtimeError();
    error(503, "Authentication unavailable");
  }

  const { error: code, error_description: description, redirect_uri: redirectUri } = cause.response;
  if (!redirectUri) error(400, "Invalid authorization request", { authorizationRequest: true });

  respond(event, redirectUri, { error: code, error_description: description });
}

/** Fails a validated request the platform could not complete. The client learns it at its redirect URI (RFC 6749 §4.1.2.1). */
function abort(event: AuthenticationEvent, redirectUri: string, cause: unknown): never {
  if (cause instanceof OAuthError) refuse(event, cause);

  const temporary = !(cause instanceof HttpError) || isHttpStatusError(cause, 429, 502, 503, 504);
  respond(event, redirectUri, { error: temporary ? "temporarily_unavailable" : "server_error" });
}

/**
 * Returns the visitor to the client's redirect URI with the response, the request's `state`, and the platform's
 * origin as `iss` (RFC 9207). The redirect URI keeps its own query (RFC 6749 §3.1.2), and the 303 makes the browser
 * follow it with a GET (RFC 9700 §4.12). Authentication matched the URI against the client registry, which is the
 * only external destination the platform redirects to.
 */
function respond(event: AuthenticationEvent, redirectUri: string, response: Record<string, string | undefined>): never {
  const states = event.url.searchParams.getAll("state");
  const parameters = { ...response, state: states.length === 1 ? states[0] : undefined, iss: event.url.origin };

  const added = new URLSearchParams();
  for (const [name, value] of Object.entries(parameters)) {
    if (value) added.append(name, value);
  }

  const location = new URL(redirectUri);
  location.search = [location.search.slice(1), added.toString()].filter(Boolean).join("&");
  redirect(303, location.href, { external: true });
}
