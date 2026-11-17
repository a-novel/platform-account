import { resolveLocale, supportedLocales } from "#lib/i18n/config.js";

import { LANGUAGE_COOKIE, parseLanguage } from "@a-novel-kit/nodelib-browser/preferences";
import { traceResponse } from "@a-novel-kit/nodelib-server/telemetry";

import type { RequestEvent } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit/hooks";

/**
 * Gives each request its locale, in the language the visitor chose or else their browser's, refuses
 * framing, keeps personal responses and email-link pages out of caches, and traces the response.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const chosen = parseLanguage(event.cookies.get(LANGUAGE_COOKIE), supportedLocales);
  const locale = resolveLocale(chosen, event.request.headers.get("accept-language"));

  event.locals.locale = locale;

  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace("%lang%", locale),
  });

  // Any page can open the login dialog, so no page may be framed by a site overlaying it (RFC 9700 §4.16).
  // Pages refuse framing in their CSP, set in vite.config.ts; this header covers every response.
  response.headers.set("x-frame-options", "DENY");
  // A response that sets cookies, or whose route chose no policy, may hold the visitor's session, so no cache
  // may keep it (RFC 9111 §5.2.2.5). A route's own policy stands otherwise, as a profile picture's does.
  if (response.headers.has("set-cookie") || !response.headers.has("cache-control")) {
    response.headers.set("cache-control", "private, no-store");
  }
  if (isEmailLinkPage(event)) {
    for (const [name, value] of Object.entries(emailLinkHeaders)) response.headers.set(name, value);
  }

  traceResponse(event, response);
  return response;
};

/** Keeps an email-link response out of caches, search indexes and referrers. */
const emailLinkHeaders = {
  "cache-control": "no-store",
  // Referrers carry the origin alone, which keeps the link's secrets private. SvelteKit still reads
  // that origin to check native form posts.
  "referrer-policy": "strict-origin",
  "x-robots-tag": "noindex, nofollow",
};

// SvelteKit routes on the decoded path, so an encoded `/%65xt/…` still renders an email-link page: the
// matched route decides, and the raw path covers the requests no route matched.
function isEmailLinkPage({ route, url }: RequestEvent): boolean {
  return route.id ? route.id.startsWith("/(standalone)/ext/") : url.pathname.startsWith("/ext/");
}
