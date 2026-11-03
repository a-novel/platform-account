import { validateEmailUpdate, validatePasswordChange } from "#lib/application/auth/forms.js";
import type { AccountInformationModel } from "#lib/application/auth/types.js";
import { requireAuthorization } from "#lib/server/auth/authorization.js";
import { emailLanguage } from "#lib/server/auth/context.js";

import type { AccountActionData } from "./account-action";

import { isHttpStatusError } from "@a-novel-kit/nodelib-browser/http";
import { credentialsUpdatePassword, shortCodeCreateEmailUpdate } from "@a-novel/service-authentication-rest";

import type { RequestEvent } from "@sveltejs/kit";
import { fail, isHttpError, isRedirect } from "@sveltejs/kit";

function passwordAction(state: AccountInformationModel["passwordState"]): AccountActionData {
  return { accountAction: { kind: "password", state } };
}

function emailAction(state: AccountInformationModel["emailState"]): AccountActionData {
  return { accountAction: { kind: "email", state } };
}

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

/** Sends a confirmation link to the new email. Authentication checks the current password first. */
async function requestEmailUpdate(event: RequestEvent) {
  const input = validateEmailUpdate(await event.request.formData());
  if (!input.success) return fail(400, emailAction({ status: "validation-error", issues: input.issues }));

  try {
    const { authentication, session } = await requireAuthorization(event);
    await shortCodeCreateEmailUpdate(authentication.api, session.accessToken, {
      ...input.value,
      lang: emailLanguage(event.locals.locale),
    });
  } catch (error) {
    if (isRedirect(error) || isHttpError(error, 403)) throw error;

    // The service checks the current password: a wrong one answers 403, a missing one 422.
    if (isHttpStatusError(error, 403)) {
      const issues = [{ field: "currentPassword", feedback: "invalidCurrentPassword" }] as const;
      return fail(403, emailAction({ status: "validation-error", issues }));
    }
    if (isHttpStatusError(error, 422)) {
      const issues = [{ field: "currentPassword", feedback: "currentPassword" }] as const;
      return fail(400, emailAction({ status: "validation-error", issues }));
    }
    return isHttpStatusError(error, 429)
      ? fail(429, emailAction({ status: "service-error", feedback: "tooManyAttempts" }))
      : fail(503, emailAction({ status: "service-error", feedback: "serviceUnavailable" }));
  }

  return emailAction({ status: "pending-email" });
}

/** The tab's form actions. Each account change checks the session again before calling the service. */
export const actions = {
  password: changePassword,
  email: requestEmailUpdate,
};
