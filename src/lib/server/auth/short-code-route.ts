import type { ShortCodePageData } from "#lib/application/auth/short-code-route.js";
import type { ShortCodeJourney } from "#lib/application/auth/types.js";

import { refuseDuringDowntime } from "../downtime";
import { getAuthenticationContext } from "./context";
import { completeShortCode, createShortCodeClient, readShortCodeModel } from "./short-code";

import type { RequestEvent } from "@sveltejs/kit";
import { fail, redirect } from "@sveltejs/kit";

const links: Record<ShortCodeJourney, ShortCodePageData["links"]> = {
  register: { continueHref: "/account", restartHref: "/?auth=register" },
  "email-update": { continueHref: "/account", restartHref: "/account" },
  "password-reset": { continueHref: "/?auth=login", restartHref: "/?auth=reset" },
};

/** Loads an email-link page without contacting the service, so a prefetch never consumes the link. */
export async function loadShortCodeRoute(
  journey: ShortCodeJourney,
  event: Pick<RequestEvent, "locals" | "url">
): Promise<ShortCodePageData> {
  // A code can't be completed while the services are stopped, so its page explains why at once.
  await refuseDuringDowntime();

  return { links: links[journey], model: readShortCodeModel(journey, event.url) };
}

/** Completes an email link. A final outcome redirects to a result URL without the link's parameters. */
export async function submitShortCodeRoute(journey: ShortCodeJourney, event: RequestEvent) {
  await refuseDuringDowntime();

  const authentication = getAuthenticationContext(event);
  const result = await completeShortCode(journey, event.url, await event.request.formData(), {
    accept: (token, identityEmail) => authentication.session.accept(token, identityEmail),
    accessToken: async () => await authentication.session.anonymousAccessToken(),
    client: createShortCodeClient(authentication.api),
    rememberIdentity: (identityEmail) => authentication.session.rememberIdentity(identityEmail),
  });

  if (result.outcome === "success" || result.outcome === "invalid") {
    redirect(303, `${event.url.pathname}?result=${result.outcome}`);
  }

  return fail(result.outcome === "validation-error" ? 400 : 503, { shortCode: result.model });
}
