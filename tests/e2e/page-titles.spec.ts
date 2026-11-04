import { expect, test } from "./fixtures";

import { screenshot } from "@a-novel-kit/nodelib-test/playwright";

import type { Page, TestInfo } from "playwright/test";

const locales = [
  {
    locale: "en-US",
    routes: [
      ["/", "Your Agora account"],
      ["/?auth=login", "Log in"],
      ["/?auth=register", "Join the Agora invitation list"],
      ["/?auth=reset", "Reset password"],
      ["/account", "Log in"],
      ["/account/devices", "Log in"],
      ["/account/privacy", "Log in"],
      ["/privacy", "Privacy"],
      ["/?auth=unknown&email=private@example.test", "Your Agora account"],
      ["/ext/account/create", "Create account: Incomplete link"],
      ["/ext/password/reset", "Reset password: Incomplete link"],
      ["/ext/email/validate", "Confirm email: Incomplete link"],
      ["/ext/password/reset?result=invalid", "Reset password: Invalid link"],
      ["/page-that-does-not-exist", "Page not found"],
    ],
  },
  {
    locale: "fr-FR",
    routes: [
      ["/", "Votre compte Agora"],
      ["/?auth=login", "Connectez-vous"],
      ["/?auth=register", "Rejoignez la liste d’invitation Agora"],
      ["/?auth=reset", "Réinitialiser mon mot de passe"],
      ["/account", "Connectez-vous"],
      ["/account/devices", "Connectez-vous"],
      ["/account/privacy", "Connectez-vous"],
      ["/privacy", "Confidentialité"],
      ["/?auth=unknown&email=private@example.test", "Votre compte Agora"],
      ["/ext/account/create", "Créer mon compte: Lien incomplet"],
      ["/ext/password/reset", "Réinitialiser mon mot de passe: Lien incomplet"],
      ["/ext/email/validate", "Confirmer mon courriel: Lien incomplet"],
      ["/ext/password/reset?result=invalid", "Réinitialiser mon mot de passe: Lien invalide"],
      ["/page-that-does-not-exist", "Page introuvable"],
    ],
  },
] as const;

/** Fixed checkpoint names, so a copy change shows as a reviewable diff. */
const checkpoints: Partial<Record<string, string>> = {
  "/": "welcome",
  "/?auth=login": "login",
  "/?auth=register": "join-the-agora-invitation-list",
  "/?auth=reset": "reset-password",
};

/** Opens a route and checks its tab title. A capturing run also records the route's checkpoint. */
async function expectTitle(page: Page, info: TestInfo, route: string, title: string, capture: boolean) {
  const response = await page.goto(route);
  await expect(page).toHaveTitle(`${title} | Agora`);
  await expect(page.locator("head > title")).toHaveCount(1);
  if (route === "/page-that-does-not-exist") expect(response?.status()).toBe(404);

  const checkpoint = checkpoints[route];
  if (!capture || !checkpoint) return;

  if (route !== "/") await expect(page.getByRole("dialog")).toBeVisible();
  await screenshot(page, info, checkpoint);
}

for (const { locale, routes } of locales) {
  for (const javaScriptEnabled of [true, false]) {
    test.describe(`${locale}, JavaScript ${javaScriptEnabled ? "enabled" : "disabled"}`, () => {
      test.use({ locale, javaScriptEnabled });

      test("page titles identify each route and authentication task", async ({ page }, info) => {
        const capture = locale === "en-US" && javaScriptEnabled;
        for (const [route, title] of routes) {
          await test.step(route, () => expectTitle(page, info, route, title, capture));
        }
      });
    });
  }
}
