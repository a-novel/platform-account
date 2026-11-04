import { accountCaller, callerFetch } from "./service-token";

import { randomUUID } from "node:crypto";

import { isHttpStatusError } from "@a-novel-kit/nodelib-browser/http";
import { createCompose, emailLink as deliveredLink, screenshot } from "@a-novel-kit/nodelib-test/playwright";
import {
  AuthenticationApi,
  Lang,
  credentialsCreate,
  shortCodeCreateRegister,
  tokenCreate,
  tokenCreateAnon,
} from "@a-novel/service-authentication-rest";

import { type BrowserContext, type Page, type TestInfo, test as base } from "playwright/test";
import { z } from "zod";

const api = new AuthenticationApi("http://127.0.0.1:14100", callerFetch(accountCaller));
const password = "Account-test-password-42!";

/** Controls only the disposable stack owned by this test run. */
export const compose = createCompose();

/** Reads a delivered email's link, which must point at the application under test. */
export function emailLink(email: string, pathname: string): Promise<string> {
  return deliveredLink(email, pathname, { mailpit: "http://127.0.0.1:14825", origin: "http://127.0.0.1:4173" });
}

/**
 * Ends the five minutes in which the platform trusts the access token without asking Authentication,
 * so the next request checks the session.
 */
export async function endSessionCheckWindow(context: BrowserContext) {
  await context.clearCookies({ name: "__Host-account_session_checked" });
}

interface PerRunValues {
  originals: Map<Text, string>;
  observer: MutationObserver;
}

/**
 * Captures a screenshot with fixed text over the values that change with each run, then puts them
 * back: an account's address holds a fresh ID, and a date the moment the stack ran. Masks cannot
 * stand in, since their boxes follow the text's width and its wrapping.
 *
 * Hydration and reloaded data write the real text back, so the fixed text holds until the capture
 * ends.
 */
export async function stableScreenshot(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => {
    const originals = new Map<Text, string>();
    const fix = (text: Text) => {
      const fixed = text.data
        .replace(/account\.tester\+[0-9a-f-]+@example\.com/g, "account.tester@example.com")
        .replace(/[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2}\s[AP]M/g, "Jan 1, 2099, 12:00 AM");
      if (fixed === text.data) return;
      originals.set(text, text.data);
      text.data = fixed;
    };
    const fixWithin = (node: Node) => {
      if (node instanceof Text) return fix(node);
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) fix(text as Text);
    };

    fixWithin(document.body);
    const observer = new MutationObserver((records) => records.forEach((record) => fixWithin(record.target)));
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    Object.assign(window, { perRunValues: { originals, observer } satisfies PerRunValues });
  });
  try {
    await screenshot(page, info, name);
  } finally {
    await page.evaluate(() => {
      const { perRunValues } = window as unknown as { perRunValues?: PerRunValues };
      perRunValues?.observer.disconnect();
      for (const [text, original] of perRunValues?.originals ?? []) text.data = original;
    });
  }
}

/** Fills and submits the login dialog. */
export async function login(page: Page, account: { email: string; password: string }) {
  await page.getByLabel(/^Email address/).fill(account.email);
  await page.getByLabel(/^Password/).fill(account.password);
  await page.getByRole("dialog").getByRole("button", { name: "Log in", exact: true }).click();
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
