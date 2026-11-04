import { validateEmailUpdate, validatePasswordChange } from "#lib/application/auth/forms.js";
import type { AccountInformationModel } from "#lib/application/auth/types.js";
import type {
  PictureEditor,
  PictureRefusal,
  ProfileServiceFeedback,
  UsernameEditor,
} from "#lib/application/profile/types.js";
import { usernameIssue } from "#lib/application/profile/username.js";
import { requireAuthorization } from "#lib/server/auth/authorization.js";
import { emailLanguage } from "#lib/server/auth/context.js";
import { getProfileContext } from "#lib/server/profile/context.js";

import { dialogUrl, localHref } from "../url-state";
import type { AccountActionData } from "./account-action";
import { editorParameter } from "./editor-state";

import { isHttpStatusError, isHttpError as isServiceError } from "@a-novel-kit/nodelib-browser/http";
import { credentialsUpdatePassword, shortCodeCreateEmailUpdate } from "@a-novel/service-authentication-rest";
import {
  PictureRefusal as ServicePictureRefusal,
  profilePictureDelete,
  profilePictureUpdate,
  profileUsernameUpdate,
} from "@a-novel/service-profile-rest";

import type { RequestEvent } from "@sveltejs/kit";
import { fail, isHttpError, isRedirect, redirect } from "@sveltejs/kit";

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

function usernameAction(editor: UsernameEditor): AccountActionData {
  return { accountAction: { kind: "username", editor } };
}

function pictureAction(editor: PictureEditor): AccountActionData {
  return { accountAction: { kind: "picture", editor } };
}

/** Sends the visitor back to the tab with its dialogs closed, where the profile shows the change. */
function closeEditor(event: RequestEvent): never {
  redirect(303, localHref(dialogUrl(event.url, editorParameter, null)));
}

/** Fails with the profile service's own trouble, which a later try may get past. */
function serviceFailure(error: unknown, result: (feedback: ProfileServiceFeedback) => AccountActionData) {
  return isHttpStatusError(error, 429) ? fail(429, result("tooManyAttempts")) : fail(503, result("serviceUnavailable"));
}

/**
 * Sets the username, or clears it when left empty. The service's rule decides; a refusal names the
 * rule the platform's mirror finds broken, if any.
 */
async function updateUsername(event: RequestEvent) {
  const value = (await event.request.formData()).get("username");
  const draft = typeof value === "string" ? value : "";

  try {
    const { session } = await requireAuthorization(event);
    await profileUsernameUpdate(getProfileContext(event).api, session.accessToken, { username: draft });
  } catch (error) {
    if (isRedirect(error) || isHttpError(error, 403)) throw error;

    if (isHttpStatusError(error, 400, 413)) {
      const issue = usernameIssue(draft) ?? "refused";
      return fail(400, usernameAction({ draft, state: { status: "validation-error", issue } }));
    }
    return serviceFailure(error, (feedback) => usernameAction({ draft, state: { status: "service-error", feedback } }));
  }

  closeEditor(event);
}

/** Reads the rule a refused picture broke from the service's problem tags. */
function pictureRefusal(error: unknown): PictureRefusal {
  if (isHttpStatusError(error, 413)) return "tooLarge";
  const reason = isServiceError(error) ? error.tags.reason : undefined;
  return reason === ServicePictureRefusal.Ratio || reason === ServicePictureRefusal.Dimensions ? reason : "format";
}

/** Replaces the picture with the one the dialog framed and encoded in the browser. */
async function updatePicture(event: RequestEvent) {
  const picture = (await event.request.formData()).get("picture");
  if (!(picture instanceof File) || picture.size === 0) {
    return fail(400, pictureAction({ status: "choosing", refusal: "format" }));
  }

  try {
    const { session } = await requireAuthorization(event);
    await profilePictureUpdate(getProfileContext(event).api, session.accessToken, { picture });
  } catch (error) {
    if (isRedirect(error) || isHttpError(error, 403)) throw error;

    if (isHttpStatusError(error, 413, 422)) {
      return fail(422, pictureAction({ status: "choosing", refusal: pictureRefusal(error) }));
    }
    return serviceFailure(error, (feedback) => pictureAction({ status: "service-error", feedback }));
  }

  closeEditor(event);
}

/** Removes the picture. A profile that holds none has nothing to remove. */
async function removePicture(event: RequestEvent) {
  try {
    const { session } = await requireAuthorization(event);
    await profilePictureDelete(getProfileContext(event).api, session.accessToken);
  } catch (error) {
    if (isRedirect(error) || isHttpError(error, 403)) throw error;

    if (!isHttpStatusError(error, 404)) {
      return serviceFailure(error, (feedback) => pictureAction({ status: "service-error", feedback }));
    }
  }

  closeEditor(event);
}

/** The tab's form actions. Each account change checks the session again before calling the service. */
export const actions = {
  password: changePassword,
  email: requestEmailUpdate,
  username: updateUsername,
  picture: updatePicture,
  removePicture,
};
