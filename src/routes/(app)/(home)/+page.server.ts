import { validateEmailRequest, validateInvitationRequest, validateLogin } from "#lib/application/auth/forms.js";
import { safeReturnTo } from "#lib/application/auth/navigation.js";
import type {
  AuthenticationFeedback,
  AuthenticationField,
  AuthenticationJourney,
  AuthenticationPanelModel,
  FormIssue,
} from "#lib/application/auth/types.js";
import { emailLanguage, getAuthenticationContext } from "#lib/server/auth/context.js";
import { refuseDuringDowntime } from "#lib/server/downtime.js";

import { readAuthView } from "../auth-dialog-state";
import type { PageServerLoad } from "./$types";

import { isHttpStatusError } from "@a-novel-kit/nodelib-browser/http";
import { shortCodeCreatePasswordReset, waitlistJoin } from "@a-novel/service-authentication-rest";

import type { RequestEvent } from "@sveltejs/kit";
import { fail, redirect } from "@sveltejs/kit";

/** Fails the action with field errors, which never echo the submitted values. */
function failValidation(journey: AuthenticationJourney, issues: readonly FormIssue<AuthenticationField>[]) {
  return fail(400, {
    authentication: { journey, state: { status: "validation-error", issues } } as AuthenticationPanelModel,
  });
}

/** Fails the action with the service outcome the dialog shows above its submit button. */
function failService(status: number, journey: AuthenticationJourney, feedback: AuthenticationFeedback, email?: string) {
  return fail(status, {
    authentication: { journey, email, state: { status: "service-error", feedback } } as AuthenticationPanelModel,
  });
}

/** Fails the action as unavailable, or as rate-limited when authentication refused the caller. */
function failUnavailable(journey: AuthenticationJourney, error: unknown, email: string) {
  return isHttpStatusError(error, 429)
    ? failService(429, journey, "tooManyAttempts", email)
    : failService(503, journey, "serviceUnavailable", email);
}

async function login(event: RequestEvent, form: FormData) {
  const input = validateLogin(form);
  if (!input.success) return failValidation("login", input.issues);

  try {
    await getAuthenticationContext(event).session.login(input.value.email, input.value.password);
  } catch (error) {
    if (isHttpStatusError(error, 401)) return failService(401, "login", "invalidCredentials", input.value.email);
    return failUnavailable("login", error, input.value.email);
  }

  redirect(303, safeReturnTo(event.url.searchParams.get("returnTo")));
}

async function requestInvitation(event: RequestEvent, form: FormData) {
  const input = validateInvitationRequest(form);
  if (!input.success) return failValidation("register", input.issues);

  try {
    const authentication = getAuthenticationContext(event);
    const accessToken = await authentication.session.anonymousAccessToken();
    await waitlistJoin(authentication.api, accessToken, {
      email: input.value.email,
      lang: emailLanguage(event.locals.locale),
    });
  } catch (error) {
    // A service older than v2.24.0 answers 409 for a listed or registered address, which gets the same
    // answer as a new one, so the confirmation reveals no membership.
    if (!isHttpStatusError(error, 409)) return failUnavailable("register", error, input.value.email);
  }

  return {
    authentication: {
      journey: "register",
      state: { status: "recorded", email: input.value.email },
    } satisfies AuthenticationPanelModel,
  };
}

async function requestPasswordReset(event: RequestEvent, form: FormData) {
  const input = validateEmailRequest(form);
  if (!input.success) return failValidation("reset", input.issues);

  try {
    const authentication = getAuthenticationContext(event);
    const accessToken = await authentication.session.anonymousAccessToken();
    await shortCodeCreatePasswordReset(authentication.api, accessToken, {
      email: input.value.email,
      lang: emailLanguage(event.locals.locale),
    });
  } catch (error) {
    return failUnavailable("reset", error, input.value.email);
  }

  return {
    authentication: {
      journey: "reset",
      state: { status: "pending-email", targetHint: input.value.email },
    } satisfies AuthenticationPanelModel,
  };
}

// The account page is the platform's only screen, so a signed-in visitor goes straight to it.
/**
 * The account page is the site's one landing page, so a visit lands there with the dialog it asked for.
 * A form posted here renders its result over the locked page instead, which a redirect would lose.
 */
export const load: PageServerLoad = ({ request, url }) => {
  if (request.method === "GET" || request.method === "HEAD") redirect(307, `/account${url.search}`);
};

/** The shell dialog's form action, which serves the journey named in the `auth` parameter. */
export const actions = {
  default: async (event: RequestEvent) => {
    await refuseDuringDowntime();

    const journey = readAuthView(event.url.searchParams);
    const form = await event.request.formData();

    if (journey === "login") return await login(event, form);
    if (journey === "register") return await requestInvitation(event, form);
    if (journey === "reset") return await requestPasswordReset(event, form);

    return failService(400, "login", "serviceUnavailable");
  },
};
