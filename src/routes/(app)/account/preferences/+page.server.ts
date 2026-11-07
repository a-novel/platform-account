import { supportedLocales } from "#lib/i18n/config.js";
import { PUBLIC_PLATFORM_DOMAIN } from "$app/env/public";

import type { PageServerLoadEvent } from "./$types";

import { LANGUAGE_COOKIE, PREFERENCE_LIFETIME_S, parseLanguage } from "@a-novel-kit/nodelib-browser/preferences";

import type { RequestEvent } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";

/** Reads the language the visitor chose on this device, or the browser's when they chose none. */
export const load = ({ cookies }: PageServerLoadEvent) => ({
  language: parseLanguage(cookies.get(LANGUAGE_COOKIE), supportedLocales) ?? ("browser" as const),
});

/**
 * Keeps the chosen language for every Agora app on this device, or forgets it so the browser's applies
 * again, then reloads the page, which renders in that language.
 */
async function changeLanguage({ cookies, request, url }: RequestEvent) {
  const value = (await request.formData()).get("language");
  const language = parseLanguage(typeof value === "string" ? value : undefined, supportedLocales);
  const shared = { path: "/", domain: PUBLIC_PLATFORM_DOMAIN };

  if (language) cookies.set(LANGUAGE_COOKIE, language, { ...shared, maxAge: PREFERENCE_LIFETIME_S });
  else cookies.delete(LANGUAGE_COOKIE, shared);

  redirect(303, url.pathname);
}

export const actions = { language: changeLanguage };
