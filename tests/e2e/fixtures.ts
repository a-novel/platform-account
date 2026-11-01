import { randomUUID } from "node:crypto";

import { isHttpStatusError } from "@a-novel-kit/nodelib-browser/http";
import { createCompose, emailLink as deliveredLink } from "@a-novel-kit/nodelib-test/playwright";
import {
  AuthenticationApi,
  Lang,
  credentialsCreate,
  shortCodeCreateRegister,
  tokenCreate,
  tokenCreateAnon,
} from "@a-novel/service-authentication-rest";

import { test as base } from "playwright/test";
import { z } from "zod";

const api = new AuthenticationApi("http://127.0.0.1:14100");
const password = "Account-test-password-42!";

/** Controls only the disposable stack owned by this test run. */
export const compose = createCompose();

/** Reads a delivered email's link, which must point at the application under test. */
export function emailLink(email: string, pathname: string): Promise<string> {
  return deliveredLink(email, pathname, { mailpit: "http://127.0.0.1:14825", origin: "http://127.0.0.1:4173" });
}

async function completeInvitation(email: string, link: string) {
  const anonymous = await tokenCreateAnon(api);
  return credentialsCreate(api, anonymous.accessToken, {
    email,
    password,
    shortCode: z.string().min(1).parse(new URL(link).searchParams.get("shortCode")),
  });
}

interface Invitation {
  email: string;
  link: string;
}
interface Account {
  email: string;
  password: string;
}

/** Creates unique, real service accounts without repeating browser setup in every journey. */
export const test = base.extend<{ invitation: Invitation; account: Account }, { administrator: string }>({
  administrator: [
    // Playwright requires destructured fixture arguments, even with no dependencies.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const email = "admin@account.test";
      let token;
      try {
        token = await tokenCreate(api, { email, password });
      } catch (error) {
        if (!isHttpStatusError(error, 401)) throw error;
        token = await completeInvitation(email, await emailLink(email, "/ext/account/create"));
      }
      await use(token.accessToken);
    },
    { scope: "worker" },
  ],
  invitation: async ({ administrator }, use) => {
    // The plus suffix isolates accounts while keeping the displayed handle stable.
    const email = `account.tester+${randomUUID()}@example.com`;
    await shortCodeCreateRegister(api, administrator, { email, lang: Lang.En });
    await use({ email, link: await emailLink(email, "/ext/account/create") });
  },
  account: async ({ invitation }, use) => {
    await completeInvitation(invitation.email, invitation.link);
    await use({ email: invitation.email, password });
  },
});

export { expect } from "playwright/test";
