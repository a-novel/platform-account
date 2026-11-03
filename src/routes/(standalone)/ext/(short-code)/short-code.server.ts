import { validateNewPassword } from "#lib/application/auth/forms.js";
import type {
  AuthenticationFeedback,
  ShortCodeJourney,
  ShortCodeScreenModel,
  ShortCodeState,
} from "#lib/application/auth/types.js";
import { getAuthenticationContext } from "#lib/server/auth/context.js";
import { refuseDuringDowntime } from "#lib/server/downtime.js";

import type { ShortCodePageData } from "./short-code";
import { type ParsedShortCodeLink, parseShortCodeLink } from "./short-code-link.server";

import { isHttpStatusError } from "@a-novel-kit/nodelib-browser/http";
import {
  AuthenticationApi,
  type Token,
  credentialsCreate,
  credentialsResetPassword,
  credentialsUpdateEmail,
} from "@a-novel/service-authentication-rest";

import type { RequestEvent } from "@sveltejs/kit";
import { fail, redirect } from "@sveltejs/kit";

/** ShortCodeClient is the service API that completes an email link. */
export interface ShortCodeClient {
  register(accessToken: string, input: { email: string; password: string; shortCode: string }): Promise<Token>;
  resetPassword(accessToken: string, input: { password: string; shortCode: string; userID: string }): Promise<void>;
  updateEmail(accessToken: string, input: { shortCode: string; userID: string }): Promise<void>;
}

/** ShortCodeCompletionContext is the visitor's session as a link completion uses it. */
export interface ShortCodeCompletionContext {
  accept(token: Token, identityEmail?: string): void;
  accessToken(): Promise<string>;
  client: ShortCodeClient;
  rememberIdentity(identityEmail: string): void;
}

/** ShortCodeCompletionOutcome tells the route whether to redirect or to show the form again. */
export type ShortCodeCompletionOutcome = "success" | "invalid" | "validation-error" | "service-error";

/** ShortCodeCompletionResult is the screen state a completion leaves, with its outcome. */
export interface ShortCodeCompletionResult {
  model: ShortCodeScreenModel;
  outcome: ShortCodeCompletionOutcome;
}

type ReadyLink<Journey extends ShortCodeJourney> = Extract<ParsedShortCodeLink, { journey: Journey }>;

/** Binds the link-completion API to an authentication client. */
export function createShortCodeClient(api: AuthenticationApi): ShortCodeClient {
  return {
    register: async (accessToken, input) => await credentialsCreate(api, accessToken, input),
    resetPassword: async (accessToken, input) => {
      await credentialsResetPassword(api, accessToken, input);
    },
    updateEmail: async (accessToken, input) => {
      await credentialsUpdateEmail(api, accessToken, input);
    },
  };
}

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

/** Completes an email link with the service. A password journey validates its form before any call. */
export async function completeShortCode(
  journey: ShortCodeJourney,
  url: URL,
  form: FormData,
  context: ShortCodeCompletionContext
): Promise<ShortCodeCompletionResult> {
  const link = parseShortCodeLink(journey, url);
  if (link.status !== "ready") return completion("invalid", journey, { status: "invalid" });
  if (link.journey === "email-update") {
    return await settle(journey, context, async (accessToken) => await confirmEmail(link, accessToken, context));
  }

  // Passwords are checked before the link spends an anonymous token.
  const validation = validateNewPassword(form);
  if (!validation.success) {
    return completion("validation-error", journey, { status: "validation-error", issues: validation.issues });
  }

  const password = validation.value.password;
  return await settle(journey, context, async (accessToken) => await setPassword(link, password, accessToken, context));
}

/** Runs a link operation with an anonymous token and maps its outcome to the completion screen. */
async function settle(
  journey: ShortCodeJourney,
  context: ShortCodeCompletionContext,
  operation: (accessToken: string) => Promise<void>
): Promise<ShortCodeCompletionResult> {
  try {
    await operation(await context.accessToken());
  } catch (error) {
    if (isHttpStatusError(error, 403, 404, 409)) return completion("invalid", journey, { status: "invalid" });

    const feedback = isHttpStatusError(error, 429) ? "tooManyAttempts" : "serviceUnavailable";
    return completion("service-error", journey, { status: "service-error", feedback });
  }

  return completion("success", journey, { status: "success", feedback: successFeedback(journey) });
}

/** Moves the account to the link's address, which then names the visitor in the shell. */
async function confirmEmail(link: ReadyLink<"email-update">, accessToken: string, context: ShortCodeCompletionContext) {
  await context.client.updateEmail(accessToken, { shortCode: link.shortCode, userID: link.userId });
  context.rememberIdentity(link.email);
}

/** Creates the invited account and signs it in, or resets the password of an existing one. */
async function setPassword(
  link: ReadyLink<"register" | "password-reset">,
  password: string,
  accessToken: string,
  context: ShortCodeCompletionContext
) {
  if (link.journey === "password-reset") {
    await context.client.resetPassword(accessToken, { password, shortCode: link.shortCode, userID: link.userId });
    return;
  }

  const token = await context.client.register(accessToken, { email: link.email, password, shortCode: link.shortCode });
  context.accept(token, link.email);
}

function completion(
  outcome: ShortCodeCompletionOutcome,
  journey: ShortCodeJourney,
  state: ShortCodeState
): ShortCodeCompletionResult {
  return { outcome, model: { journey, state } };
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
