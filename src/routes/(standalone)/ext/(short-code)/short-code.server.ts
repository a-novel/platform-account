import { validateNewPassword } from "#lib/application/auth/forms.js";
import type { AuthenticationFeedback } from "#lib/application/auth/types.js";
import { emailLanguage, getAuthenticationContext } from "#lib/server/auth/context.js";
import { refuseDuringDowntime } from "#lib/server/downtime.js";
import { serviceFeedback } from "#lib/server/service-fetch.js";

import type { ShortCodeJourney, ShortCodeScreenModel, ShortCodeState } from "./controller.svelte";
import type { ShortCodeActionData, ShortCodePageData } from "./short-code";
import { type ParsedShortCodeLink, parseShortCodeLink } from "./short-code-link.server";

import { isHttpStatusError } from "@a-novel-kit/nodelib-browser/http";
import {
  credentialsCreate,
  credentialsResetPassword,
  credentialsUpdateEmail,
} from "@a-novel/service-authentication-rest";

import type { RequestEvent } from "@sveltejs/kit";
import { fail, redirect } from "@sveltejs/kit";

type ReadyLink = Extract<ParsedShortCodeLink, { status: "ready" }>;

/** Reads the screen state of an email-link URL without keeping its code or target. */
export function readShortCodeModel(journey: ShortCodeJourney, url: URL): ShortCodeScreenModel {
  const result = url.searchParams.getAll("result");

  if (result.length === 1 && result[0] === "success") {
    return { journey, state: { status: "success", feedback: successFeedback(journey) } };
  }
  if (result.length === 1 && result[0] === "invalid") {
    return { journey, state: { status: "invalid" } };
  }

  return { journey, state: { status: parseShortCodeLink(journey, url).status } };
}

function successFeedback(journey: ShortCodeJourney): AuthenticationFeedback {
  if (journey === "register") return "registrationCompleted";
  if (journey === "email-update") return "emailUpdated";
  return "passwordReset";
}

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

  const form = await event.request.formData();
  const link = parseShortCodeLink(journey, event.url);
  if (link.status !== "ready") redirectToResult(event, "invalid");

  // Passwords are checked before the link spends an anonymous token.
  const validation = link.journey === "email-update" ? null : validateNewPassword(form);
  if (validation && !validation.success) {
    return failCompletion(400, journey, { status: "validation-error", issues: validation.issues });
  }

  try {
    await completeLink(event, link, validation?.value.password ?? "");
  } catch (error) {
    if (isHttpStatusError(error, 403, 404, 409)) redirectToResult(event, "invalid");

    const { status, feedback } = serviceFeedback(error);
    return failCompletion(status, journey, { status: "service-error", feedback });
  }

  redirectToResult(event, "success");
}

/**
 * Completes the link with an anonymous token: creates the invited account and signs it in, resets the
 * password, or moves the account to the link's address, which then names the visitor in the shell.
 */
async function completeLink(event: RequestEvent, link: ReadyLink, password: string) {
  const { api, session } = getAuthenticationContext(event);
  const accessToken = await session.anonymousAccessToken();

  switch (link.journey) {
    case "register": {
      const { email, shortCode } = link;
      session.accept(await credentialsCreate(api, accessToken, { email, password, shortCode }), email);
      return;
    }
    case "password-reset":
      await credentialsResetPassword(api, accessToken, { password, shortCode: link.shortCode, userID: link.userId });
      return;
    case "email-update": {
      const lang = emailLanguage(event.locals.locale);
      await credentialsUpdateEmail(api, accessToken, { shortCode: link.shortCode, userID: link.userId, lang });
      session.rememberIdentity(link.email);
    }
  }
}

/** Fails the completion with the screen state its form shows again. */
function failCompletion(status: number, journey: ShortCodeJourney, state: ShortCodeState) {
  const data: ShortCodeActionData = { shortCode: { journey, state } };
  return fail(status, data);
}

function redirectToResult(event: RequestEvent, result: "success" | "invalid"): never {
  redirect(303, `${event.url.pathname}?result=${result}`);
}
