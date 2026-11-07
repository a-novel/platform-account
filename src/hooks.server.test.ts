import { handle } from "./hooks.server";

import { describe, expect, it, vi } from "vitest";

import { SpanStatusCode, TraceFlags, trace } from "@opentelemetry/api";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import type { RequestEvent } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit/hooks";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const SPAN_ID = "00f067aa0ba902b7";

function event(path: string, language?: string, routeId?: string | null, chosen?: string): RequestEvent {
  const url = new URL(path, "https://account.test");
  const root = trace.wrapSpanContext({ traceId: TRACE_ID, spanId: SPAN_ID, traceFlags: TraceFlags.SAMPLED });
  return {
    url,
    locals: {},
    request: new Request(url, { headers: language ? { "accept-language": language } : undefined }),
    route: { id: routeId === undefined ? url.pathname : routeId },
    cookies: { get: (name: string) => (name === "language" ? chosen : undefined) },
    tracing: { enabled: false, root, current: root },
  } as unknown as RequestEvent;
}

describe("request hook", () => {
  it("keeps translations and document language isolated across concurrent requests", async () => {
    const french = event("/", "fr-CA,fr;q=0.9,en;q=0.8");
    const english = event("/", "de");
    const resolve = vi.fn<Parameters<Handle>[0]["resolve"]>(async (request, options) => {
      await Promise.resolve();
      const html = await options?.transformPageChunk?.({ html: '<html lang="%lang%">', done: true });
      return new Response(html + request.locals.i18n.t("shell.accountFallback"));
    });
    const [fr, en] = await Promise.all([handle({ event: french, resolve }), handle({ event: english, resolve })]);
    await expect(fr.text()).resolves.toBe('<html lang="fr">Mon compte');
    await expect(en.text()).resolves.toBe('<html lang="en">Account');
    expect(french.locals.locale).toBe("fr");
    expect(english.locals.locale).toBe("en");
    expect(french.locals.i18n).not.toBe(english.locals.i18n);
  });

  it.each([
    { name: "a chosen language outranks the browser's", chosen: "fr", want: "fr" },
    { name: "an unsupported choice leaves the browser's", chosen: "de", want: "en" },
  ])("$name", async ({ chosen, want }) => {
    const request = event("/", "en-GB,en;q=0.9", undefined, chosen);

    await handle({ event: request, resolve: vi.fn().mockResolvedValue(new Response()) });

    expect(request.locals.locale).toBe(want);
  });

  it.each([200, 400, 303, 503])("protects secure-link responses with status %s", async (status) => {
    const resolved = new Response("private page", {
      status,
      headers: {
        "cache-control": "public",
        "content-type": "text/html",
        location: "/ext/account/create?result=success",
      },
    });
    const response = await handle({
      event: event(
        "/ext/account/create?shortCode=private-code",
        undefined,
        "/(standalone)/ext/(short-code)/account/create"
      ),
      resolve: vi.fn().mockResolvedValue(resolved),
    });
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("content-type")).toBe("text/html");
    expect(response.headers.get("location")).toBe("/ext/account/create?result=success");
    await expect(response.text()).resolves.toBe("private page");
  });

  it.each([
    [
      "an encoded path to an email-link page",
      "/%65xt/password/reset?shortCode=private-code",
      "/(standalone)/ext/(short-code)/password/reset",
    ],
    ["an email-link address no route matched", "/ext/unknown?shortCode=private-code", null],
  ])("protects %s", async (_, path, routeId) => {
    const response = await handle({
      event: event(path, undefined, routeId),
      resolve: vi.fn().mockResolvedValue(new Response("page", { headers: { "cache-control": "public" } })),
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin");
  });

  it("keeps a response rendered with a session out of every cache", async () => {
    const signedIn = {
      ...event("/privacy"),
      cookies: { get: (name: string) => (name === "__Host-account_refresh_token" ? "refresh" : undefined) },
    } as RequestEvent;
    const response = await handle({
      event: signedIn,
      resolve: vi.fn().mockResolvedValue(new Response("page", { headers: { "cache-control": "public, max-age=60" } })),
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("lets a signed-in visitor's picture keep its shared cache policy", async () => {
    const picture = {
      ...event("/profile/picture/019a4e2c-7d1f-7c3a-9b2e-5f1d0c8a4b21?v=1", undefined, "/profile/picture/[id]"),
      cookies: { get: (name: string) => (name === "__Host-account_access_token" ? "access" : undefined) },
    } as RequestEvent;
    const cached = { "cache-control": "public, max-age=31536000, immutable" };

    const shared = await handle({
      event: picture,
      resolve: vi.fn().mockResolvedValue(new Response("", { headers: cached })),
    });
    expect(shared.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");

    // A refreshed or new session puts the visitor's tokens in the response, which only they may keep.
    const withCookie = new Response("", { headers: { ...cached, "set-cookie": "__Host-account_access_token=new" } });
    const refreshed = await handle({ event: picture, resolve: vi.fn().mockResolvedValue(withCookie) });
    expect(refreshed.headers.get("cache-control")).toBe("private, no-store");
  });

  it.each([200, 303, 400])("refuses framing of every response with status %s", async (status) => {
    const response = await handle({
      event: event("/authorize?client_id=studio"),
      resolve: vi.fn().mockResolvedValue(new Response(null, { status })),
    });
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("preserves caching policy on ordinary pages", async () => {
    const response = await handle({
      event: event("/"),
      resolve: vi.fn().mockResolvedValue(new Response("home", { headers: { "cache-control": "private" } })),
    });
    expect(response.headers.get("cache-control")).toBe("private");
    expect(response.headers.has("x-robots-tag")).toBe(false);
  });

  it.each([
    { name: "a page", method: "GET", route: "/", status: 200, want: { name: "GET /", code: SpanStatusCode.UNSET } },
    {
      name: "a refusal",
      method: "POST",
      route: "/",
      status: 400,
      want: { name: "POST /", code: SpanStatusCode.UNSET },
    },
    {
      name: "an unknown path",
      method: "GET",
      route: null,
      status: 404,
      want: { name: "GET", code: SpanStatusCode.UNSET },
    },
    { name: "a fault", method: "GET", route: "/", status: 500, want: { name: "GET /", code: SpanStatusCode.ERROR } },
  ])("traces the response to $name on the request's span", async ({ method, route, status, want }) => {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
    const root = provider.getTracer("test").startSpan("sveltekit.handle.root");
    const request = {
      ...event("/"),
      request: new Request("https://studio.test/", { method }),
      route: { id: route },
      tracing: { enabled: true, root, current: root },
    } as unknown as RequestEvent;

    await handle({ event: request, resolve: async () => new Response(null, { status }) });
    root.end();

    const [span] = exporter.getFinishedSpans();
    expect(span?.name).toBe(want.name);
    expect(span?.attributes["http.response.status_code"]).toBe(status);
    expect(span?.status.code).toBe(want.code);
  });
});
