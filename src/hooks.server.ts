import { resolveLocale } from "#lib/i18n/config.js";
import { createI18n } from "#lib/i18n/instance.js";
import { hasSession } from "#lib/server/auth/session.js";
import { secureShortCodeResponse } from "#lib/server/auth/short-code-response.js";

import { SpanStatusCode } from "@opentelemetry/api";
import type { RequestEvent } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit/hooks";

/**
 * Gives each request its own locale and translations, hands its trace to the page, refuses framing,
 * keeps signed-in and email-link pages out of caches, and traces the response.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const locale = resolveLocale(event.request.headers.get("accept-language"));

  event.locals.i18n = createI18n(locale);
  event.locals.locale = locale;

  const trace = pageTrace(event);
  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace("%lang%", locale).replace("%trace%", trace),
  });

  // Any page can open the login dialog, so no page may be framed by a site overlaying it (RFC 9700 §4.16).
  // Pages refuse framing in their CSP, set in vite.config.ts; this header covers every response.
  response.headers.set("x-frame-options", "DENY");
  // A response rendered with a session is the visitor's alone, so no cache may keep it (RFC 9111 §5.2.2.5).
  if (hasSession(event.cookies)) response.headers.set("cache-control", "private, no-store");

  traceResponse(event, response);
  return isEmailLinkPage(event) ? secureShortCodeResponse(response) : response;
};

// SvelteKit routes on the decoded path, so an encoded `/%65xt/…` still renders an email-link page: the
// matched route decides, and the raw path covers the requests no route matched.
function isEmailLinkPage({ route, url }: RequestEvent): boolean {
  return route.id ? route.id.startsWith("/(standalone)/ext/") : url.pathname.startsWith("/ext/");
}

// The browser's page load continues the request's trace from this tag, as `traceId-spanId-sampled`.
function pageTrace({ tracing }: RequestEvent): string {
  if (!tracing.enabled) return "";

  const { traceId, spanId, traceFlags } = tracing.root.spanContext();
  return `${traceId}-${spanId}-${traceFlags & 1}`;
}

// Names the request's span after its route, as `GET /(studio)/account`, and records the response's
// status, so span metrics split the traffic by page and tell a refusal from a fault. A request that
// matched no route keeps its method alone, so no path names a span.
function traceResponse({ request, route, tracing }: RequestEvent, { status }: Response): void {
  tracing.root.updateName(route.id ? `${request.method} ${route.id}` : request.method);
  tracing.root.setAttribute("http.response.status_code", status);

  if (status >= 500) tracing.root.setStatus({ code: SpanStatusCode.ERROR });
}
