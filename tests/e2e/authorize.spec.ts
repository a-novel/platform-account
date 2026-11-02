import { client } from "./client";
import { expect, login, test } from "./fixtures";
import { callerFetch } from "./service-token";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { screenshot } from "@a-novel-kit/nodelib-test/playwright";
import { AuthenticationApi, authorizationCodeExchange, claimsGet } from "@a-novel/service-authentication-rest";

import type { Page } from "playwright/test";

const issuer = "http://127.0.0.1:4173";
const clientApi = new AuthenticationApi("http://127.0.0.1:14100", callerFetch(client.caller));

/** An authorization request from the stub client, with a fresh state and PKCE pair (RFC 7636). */
function authorizationRequest(overrides: Record<string, string> = {}) {
  const verifier = randomBytes(32).toString("base64url");
  const parameters = {
    response_type: "code",
    client_id: client.id,
    redirect_uri: client.redirectUri,
    state: randomUUID(),
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    ...overrides,
  };
  return { href: `/authorize?${new URLSearchParams(parameters)}`, state: parameters.state, verifier };
}

/** Reads the authorization response the browser brought back to the stub client. */
async function clientResponse(page: Page) {
  await page.waitForURL((url) => url.href.startsWith(`${client.redirectUri}&`));
  return Object.fromEntries(new URL(page.url()).searchParams);
}

/** Exchanges a code as the stub client's server does, and reads whose session the tokens open. */
async function exchange(code: string, verifier: string) {
  const tokens = await authorizationCodeExchange(clientApi, {
    code,
    code_verifier: verifier,
    redirect_uri: client.redirectUri,
  });
  return await claimsGet(clientApi, tokens.access_token);
}

test("a client signs a visitor in through the account platform, then again without a form", async ({
  page,
  account,
}, info) => {
  const first = authorizationRequest();
  await page.goto(first.href);
  await expect(page).toHaveURL(/^[^?]+\/\?auth=login&returnTo=%2Fauthorize%3F/);

  const dialog = page.getByRole("dialog", { name: "Log in" });
  await expect(dialog).toHaveAccessibleDescription(
    "Log in with your Agora account to return to the app you came from."
  );
  await expect(dialog.getByRole("link", { name: "Forgot password?" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Register" })).toBeVisible();
  await screenshot(page, info, "authorization-login");

  await login(page, account);
  const response = await clientResponse(page);
  expect(response).toEqual({ tenant: "e2e", code: expect.any(String), state: first.state, iss: issuer });
  const claims = await exchange(response.code ?? "", first.verifier);
  expect(claims.userID).toEqual(expect.any(String));

  const second = authorizationRequest();
  await page.goto(second.href);
  const again = await clientResponse(page);
  expect(again).toEqual({ tenant: "e2e", code: expect.any(String), state: second.state, iss: issuer });
  await expect(exchange(again.code ?? "", second.verifier)).resolves.toMatchObject({ userID: claims.userID });
});

test("a request from an unknown client or to an unregistered redirect URI stays on the error page", async ({
  page,
}, info) => {
  const refusals = {
    "an unknown client": { client_id: "unknown" },
    "an unregistered redirect URI": { redirect_uri: "http://127.0.0.1:4181/elsewhere" },
  };

  for (const [name, overrides] of Object.entries(refusals)) {
    await test.step(name, () => expectErrorPage(page, authorizationRequest(overrides).href));
  }
  await screenshot(page, info, "authorization-request-refused");
});

async function expectErrorPage(page: Page, href: string) {
  const response = await page.goto(href);

  expect(response?.status()).toBe(400);
  expect(response?.headers()).toMatchObject({
    "x-frame-options": "DENY",
    "content-security-policy": "frame-ancestors 'none'",
  });
  await expect(page).toHaveURL(href);
  await expect(page).toHaveTitle("This request to log in can’t be accepted | Agora");
  await expect(page.getByRole("heading", { name: "This request to log in can’t be accepted", level: 1 })).toBeVisible();
}

test("any other refusal returns to the client with a 303, the state and the issuer", async ({ request }) => {
  const { href, state } = authorizationRequest({ code_challenge_method: "plain" });
  const response = await request.get(href, { maxRedirects: 0 });

  expect(response.status()).toBe(303);
  const location = response.headers().location ?? "";
  expect(location.startsWith(`${client.redirectUri}&`)).toBe(true);
  expect(Object.fromEntries(new URL(location).searchParams)).toMatchObject({
    tenant: "e2e",
    error: "invalid_request",
    state,
    iss: issuer,
  });
});

test("the login refuses a form another site posts", async ({ request }) => {
  const response = await request.post(`/?auth=login&returnTo=${encodeURIComponent(authorizationRequest().href)}`, {
    form: { email: "visitor@example.com", password: "Account-test-password-42!" },
    headers: { origin: "https://attacker.example" },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(403);
});
