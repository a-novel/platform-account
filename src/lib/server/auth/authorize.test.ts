import { authorize } from "./authorize";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type Cookies, type RequestEvent, isHttpError, isRedirect } from "@sveltejs/kit";

const env = vi.hoisted(() => ({
  AUTHENTICATION_SERVICE_AUDIENCE: undefined,
  AUTHENTICATION_SERVICE_URL: "https://authentication.test",
  DOWNTIME_URL: undefined,
  HEALTHCHECK_TIMEOUT_MS: undefined,
  SERVICE_TOKEN_PATH: undefined,
  STUDIO_URL: "https://studio.test",
}));

vi.mock("$app/env/private", () => env);

const published = vi.hoisted(() => ({ downtime: null as { components: string[]; start: Date; end: Date } | null }));

vi.mock("@a-novel-kit/nodelib-server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@a-novel-kit/nodelib-server")>()),
  createDowntimeReader: () => async () => published.downtime,
}));

const fetchService = vi.fn<typeof fetch>();

const callback = "https://client.test/auth/callback?tenant=a%20b";
const query =
  "response_type=code&client_id=client&redirect_uri=https%3A%2F%2Fclient.test%2Fauth%2Fcallback%3Ftenant%3Da%2520b" +
  "&state=opaque+state%2F1&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256";
const sessionCookies = { account_access_token: "private-access", account_refresh_token: "private-refresh" };
const identity = { userID: "140f24ee-1531-4a9d-ace8-20b38e1b21bc", roles: ["auth:user"] };

/** An OAuth error response, as Authentication answers a refused authorization request. */
function oauthError(error: string, redirectUri?: string) {
  return Response.json(
    { error, error_description: `${error} description`, redirect_uri: redirectUri },
    { status: 400 }
  );
}

function request(search: string, cookieValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(cookieValues));
  const cookies = {
    get: vi.fn((name: string) => values.get(name)),
    set: vi.fn<Cookies["set"]>((name, value) => {
      values.set(name, value);
    }),
    delete: vi.fn<Cookies["delete"]>((name) => {
      values.delete(name);
    }),
  };
  const event = {
    cookies,
    getClientAddress: () => "192.0.2.1",
    url: new URL(`/authorize?${search}`, "https://account.test"),
  } as unknown as RequestEvent;
  return { event, values };
}

/** Runs the authorization endpoint and returns where it sent the browser, or the error page it failed with. */
async function outcome(event: RequestEvent) {
  try {
    await authorize(event);
  } catch (cause) {
    if (isRedirect(cause)) return { status: cause.status, location: cause.location };
    if (isHttpError(cause)) return { status: cause.status, page: cause.body };
    throw cause;
  }
  throw new Error("The authorization endpoint answered neither a redirect nor an error.");
}

/** The calls Authentication received, by method and path. */
function sentCalls() {
  return fetchService.mock.calls.map(([url, init]) => `${init?.method} ${new URL(String(url)).pathname}`);
}

beforeEach(() => {
  fetchService.mockReset().mockRejectedValue(new Error("Unexpected authentication request"));
  vi.stubGlobal("fetch", fetchService);
});

afterEach(() => {
  vi.unstubAllGlobals();
  published.downtime = null;
});

describe("authorization endpoint", () => {
  it("issues a code within the visitor's session and returns it with the state and the issuer", async () => {
    const { event } = request(query, sessionCookies);
    fetchService
      .mockResolvedValueOnce(Response.json({ redirect_uri: callback }))
      .mockResolvedValueOnce(Response.json(identity))
      .mockResolvedValueOnce(Response.json({ code: "issued-code", redirect_uri: callback }));

    await expect(outcome(event)).resolves.toEqual({
      status: 303,
      location: `${callback}&code=issued-code&state=opaque+state%2F1&iss=https%3A%2F%2Faccount.test`,
    });
    expect(sentCalls()).toEqual([
      "GET /v2/oauth/authorization-request",
      "GET /v2/session",
      "POST /v2/oauth/authorization-code",
    ]);

    const [validation] = fetchService.mock.calls[0] ?? [];
    expect(new URL(String(validation)).search).toBe(`?${new URLSearchParams(query)}`);
    const [, issue] = fetchService.mock.calls[2] ?? [];
    expect(new Headers(issue?.headers).get("authorization")).toBe("Bearer private-access");
    expect(String(issue?.body)).toBe(new URLSearchParams(query).toString());
  });

  it("logs a visitor without a session in, then returns to the same request", async () => {
    const { event } = request(query);
    fetchService.mockResolvedValueOnce(Response.json({ redirect_uri: callback }));

    await expect(outcome(event)).resolves.toEqual({
      status: 303,
      location: "/?" + new URLSearchParams({ auth: "login", returnTo: `/authorize?${new URLSearchParams(query)}` }),
    });
    expect(sentCalls()).toEqual(["GET /v2/oauth/authorization-request"]);
  });

  it("logs the visitor in again when Authentication reports their session ended", async () => {
    const { event, values } = request(query, sessionCookies);
    fetchService
      .mockResolvedValueOnce(Response.json({ redirect_uri: callback }))
      .mockResolvedValueOnce(Response.json(identity))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(outcome(event)).resolves.toMatchObject({
      status: 303,
      location: expect.stringMatching(/^\/\?auth=login/),
    });
    expect([...values.keys()]).toEqual([]);
  });

  it.each([
    ["an unknown client", "invalid_client"],
    ["a redirect URI the client did not register", "invalid_request"],
  ])("shows the error page for %s and redirects nowhere", async (_, error) => {
    const { event } = request(query, sessionCookies);
    fetchService.mockResolvedValueOnce(oauthError(error));

    await expect(outcome(event)).resolves.toEqual({
      status: 400,
      page: { status: 400, message: "Invalid authorization request", authorizationRequest: true },
    });
    expect(sentCalls()).toEqual(["GET /v2/oauth/authorization-request"]);
  });

  it("returns any other refusal to the client with the state and the issuer", async () => {
    const { event } = request(query);
    fetchService.mockResolvedValueOnce(oauthError("invalid_request", callback));

    await expect(outcome(event)).resolves.toEqual({
      status: 303,
      location:
        `${callback}&error=invalid_request&error_description=invalid_request+description` +
        "&state=opaque+state%2F1&iss=https%3A%2F%2Faccount.test",
    });
  });

  it.each([
    ["no state", "response_type=token"],
    ["a repeated state", "response_type=token&state=one&state=two"],
  ])("echoes no state for a request with %s", async (_, search) => {
    const { event } = request(search);
    fetchService.mockResolvedValueOnce(oauthError("unsupported_response_type", "https://client.test/callback"));

    await expect(outcome(event)).resolves.toMatchObject({
      location:
        "https://client.test/callback?error=unsupported_response_type" +
        "&error_description=unsupported_response_type+description&iss=https%3A%2F%2Faccount.test",
    });
  });

  it("returns a refused code to the client", async () => {
    const { event } = request(query, sessionCookies);
    fetchService
      .mockResolvedValueOnce(Response.json({ redirect_uri: callback }))
      .mockResolvedValueOnce(Response.json(identity))
      .mockResolvedValueOnce(oauthError("invalid_request", callback));

    await expect(outcome(event)).resolves.toMatchObject({
      location: expect.stringContaining(`${callback}&error=invalid_request&`),
    });
  });

  it.each([
    ["an outage", () => new Response(null, { status: 503 })],
    ["a network failure", () => new TypeError("fetch failed")],
    ["a malformed refusal", () => new Response("Bad Request", { status: 400 })],
  ])("shows the unavailable page when %s prevents the validation", async (_, failure) => {
    const { event } = request(query);
    const response = failure();
    if (response instanceof Response) fetchService.mockResolvedValueOnce(response);
    else fetchService.mockRejectedValueOnce(response);

    await expect(outcome(event)).resolves.toEqual({
      status: 503,
      page: { status: 503, message: "Authentication unavailable" },
    });
  });

  it("shows the maintenance page when Authentication refuses the validation for a planned downtime", async () => {
    const { event } = request(query);
    fetchService.mockResolvedValueOnce(
      Response.json(
        { type: "about:blank", title: "Service Unavailable", status: 503, tags: { downtime: true } },
        { status: 503, headers: { "Content-Type": "application/problem+json" } }
      )
    );

    await expect(outcome(event)).resolves.toMatchObject({ status: 503, page: { downtime: true } });
  });

  it("shows the maintenance page without calling Authentication once a planned downtime started", async () => {
    published.downtime = {
      components: ["service-authentication.database"],
      start: new Date("2026-01-01T00:00:00Z"),
      end: new Date("2099-01-01T00:00:00Z"),
    };
    const { event } = request(query, sessionCookies);

    await expect(outcome(event)).resolves.toMatchObject({ status: 503, page: { downtime: true } });
    expect(fetchService).not.toHaveBeenCalled();
  });

  const failures = [
    ["the session check fails", 503, "temporarily_unavailable"],
    ["the code issue is rate-limited", 429, "temporarily_unavailable"],
    ["the code issue fails", 500, "server_error"],
    ["the code issue refuses the caller", 403, "server_error"],
  ] as const;

  it.each(failures)("returns %s to the client as %s", async (failure, status, error) => {
    const { event } = request(query, sessionCookies);
    fetchService.mockResolvedValueOnce(Response.json({ redirect_uri: callback }));
    if (failure !== "the session check fails") fetchService.mockResolvedValueOnce(Response.json(identity));
    fetchService.mockResolvedValueOnce(new Response(null, { status }));

    await expect(outcome(event)).resolves.toEqual({
      status: 303,
      location: `${callback}&error=${error}&state=opaque+state%2F1&iss=https%3A%2F%2Faccount.test`,
    });
  });
});
