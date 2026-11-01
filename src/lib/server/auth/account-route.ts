import { type AccountActionData, createAccountModel } from "#lib/application/auth/account-action.js";
import { validateEmailUpdate, validatePasswordChange } from "#lib/application/auth/forms.js";
import type { AccountCredentialsState, AccountScreenModel } from "#lib/application/auth/types.js";

import { requireAuthorization } from "./authorization";
import { type AuthenticationEvent, emailLanguage } from "./context";
import { logoutAuthentication } from "./logout";
import { readTokenExpiry } from "./session";

import { isHttpStatusError } from "@a-novel-kit/nodelib-browser/http";
import {
  type AuthenticationApi,
  credentialsGetSelf,
  credentialsUpdatePassword,
  shortCodeCreateEmailUpdate,
} from "@a-novel/service-authentication-rest";

import type { RequestEvent } from "@sveltejs/kit";
import { fail, isHttpError, isRedirect } from "@sveltejs/kit";

function formatExpiry(token: string | undefined, dates: Intl.DateTimeFormat, fallback: string): string {
  const expiry = token ? readTokenExpiry(token) : null;
  return expiry ? dates.format(expiry) : fallback;
}

/** Reads the account's email and its pending change. A failure hides only them: the forms still work. */
async function loadCredentials(
  api: AuthenticationApi,
  accessToken: string,
  dates: Intl.DateTimeFormat
): Promise<AccountCredentialsState> {
  try {
    const { email, pendingEmail } = await credentialsGetSelf(api, accessToken);
    return {
      status: "ready",
      email,
      pendingEmail: pendingEmail && { email: pendingEmail.email, expiresAt: dates.format(pendingEmail.expiresAt) },
    };
  } catch {
    // The trace records the failed call.
    return { status: "unavailable" };
  }
}

function passwordAction(state: AccountScreenModel["passwordState"]): AccountActionData {
  return { accountAction: { kind: "password", state } };
}

function emailAction(state: AccountScreenModel["emailState"]): AccountActionData {
  return { accountAction: { kind: "email", state } };
}

/** Loads the account recap and email. An authentication outage still renders the account forms. */
export const loadAccount = async (event: AuthenticationEvent & Pick<RequestEvent, "locals">) => {
  const { locals } = event;
  const t = locals.i18n.getFixedT(locals.locale, "common");
  const dates = new Intl.DateTimeFormat(locals.locale, { dateStyle: "medium", timeStyle: "short" });

  try {
    const { authentication, session } = await requireAuthorization(event);
    const credentials = await loadCredentials(authentication.api, session.accessToken, dates);
    // The shell names the visitor from a cookie, which an email change on another device leaves stale.
    if (credentials.status === "ready") authentication.session.rememberIdentity(credentials.email);

    return {
      authorization: "allowed" as const,
      accountModel: createAccountModel(
        {
          status: "ready",
          userId: session.claims.userID,
          roles: session.claims.roles ?? [],
          accessExpiresAt: formatExpiry(session.accessToken, dates, t("authFlow.expiryUnavailable")),
          refreshExpiresAt: formatExpiry(session.refreshToken, dates, t("authFlow.expiryUnavailable")),
        },
        credentials
      ),
    };
  } catch (error) {
    // Redirects, refusals and planned downtimes render their own pages. Any other failure keeps the forms.
    if (isRedirect(error) || isHttpError(error, 403) || (isHttpError(error, 503) && error.body.downtime)) throw error;

    return {
      authorization: "unavailable" as const,
      accountModel: createAccountModel({ status: "error", feedback: "sessionUnavailable" }, { status: "unavailable" }),
    };
  }
};

async function changePassword(event: RequestEvent) {
  const input = validatePasswordChange(await event.request.formData());
  if (!input.success) return fail(400, passwordAction({ status: "validation-error", issues: input.issues }));

  try {
    const { authentication, session } = await requireAuthorization(event);
    await credentialsUpdatePassword(authentication.api, session.accessToken, input.value);
  } catch (error) {
    if (isRedirect(error) || isHttpError(error, 403)) throw error;

    // A 403 from the service means a wrong current password, which the form shows on its field.
    if (isHttpStatusError(error, 403)) {
      const issues = [{ field: "currentPassword", feedback: "invalidCurrentPassword" }] as const;
      return fail(403, passwordAction({ status: "validation-error", issues }));
    }
    return fail(503, passwordAction({ status: "service-error", feedback: "serviceUnavailable" }));
  }

  return passwordAction({ status: "success", feedback: "passwordChanged" });
}

async function requestEmailUpdate(event: RequestEvent) {
  const input = validateEmailUpdate(await event.request.formData());
  if (!input.success) return fail(400, emailAction({ status: "validation-error", issues: input.issues }));

  try {
    const { authentication, session } = await requireAuthorization(event);
    await shortCodeCreateEmailUpdate(authentication.api, session.accessToken, {
      email: input.value.email,
      lang: emailLanguage(event.locals.locale),
    });
  } catch (error) {
    if (isRedirect(error) || isHttpError(error, 403)) throw error;

    return isHttpStatusError(error, 429)
      ? fail(429, emailAction({ status: "service-error", feedback: "tooManyAttempts" }))
      : fail(503, emailAction({ status: "service-error", feedback: "serviceUnavailable" }));
  }

  return emailAction({ status: "pending-email" });
}

/** The account page's form actions. Each account change checks the session again before calling the service. */
export const accountActions = {
  password: changePassword,
  email: requestEmailUpdate,
  logout: logoutAuthentication,
};
