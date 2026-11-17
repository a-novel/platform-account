import { textValue, validateEmailUpdate, validatePasswordChange } from "#lib/application/auth/forms.js";
import { usernameIssue } from "#lib/application/profile/username.js";
import { requireAuthorization, rethrowRefusal } from "#lib/server/auth/authorization.js";
import { emailLanguage } from "#lib/server/auth/context.js";
import { getProfileContext } from "#lib/server/profile/context.js";
import { serviceFeedback } from "#lib/server/service-fetch.js";

import { dialogUrl, editorParameter, localHref } from "../url-state";
import type { AccountActionData } from "./account-action";
import type { AccountInformationModel, PictureEditor, PictureRefusal, UsernameEditor } from "./controller.svelte";

import { isHttpStatusError, isHttpError as isServiceError } from "@a-novel-kit/nodelib-browser/http";
import {
  credentialsUpdatePassword,
  shortCodeCancelEmailUpdate,
  shortCodeCreateEmailUpdate,
} from "@a-novel/service-authentication-rest";
import {
  PictureRefusal as ServicePictureRefusal,
  profilePictureDelete,
  profilePictureUpdate,
  profileUsernameUpdate,
} from "@a-novel/service-profile-rest";

import type { RequestEvent } from "@sveltejs/kit";
import { fail, redirect } from "@sveltejs/kit";

function passwordAction(state: AccountInformationModel["passwordState"]): AccountActionData {
  return { accountAction: { kind: "password", state } };
}

function emailAction(state: AccountInformationModel["emailState"], email?: string): AccountActionData {
  return { accountAction: { kind: "email", state, email } };
}

async function changePassword(event: RequestEvent) {
  const input = validatePasswordChange(await event.request.formData());
  if (!input.success) return fail(400, passwordAction({ status: "validation-error", issues: input.issues }));

  try {
    const { authentication, session } = await requireAuthorization(event);
    await credentialsUpdatePassword(authentication.api, session.accessToken, input.value);
  } catch (error) {
    rethrowRefusal(error);

    // A 403 from the service means a wrong current password, which the form shows on its field.
    if (isHttpStatusError(error, 403)) {
      const issues = [{ field: "currentPassword", feedback: "invalidCurrentPassword" }] as const;
      return fail(403, passwordAction({ status: "validation-error", issues }));
    }
    const { status, feedback } = serviceFeedback(error);
    return fail(status, passwordAction({ status: "service-error", feedback }));
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
    rethrowRefusal(error);

    // The service checks the current password: a wrong one answers 403, a missing one 422.
    if (isHttpStatusError(error, 403)) {
      const issues = [{ field: "currentPassword", feedback: "invalidCurrentPassword" }] as const;
      return fail(403, emailAction({ status: "validation-error", issues }, input.value.email));
    }
    if (isHttpStatusError(error, 422)) {
      const issues = [{ field: "currentPassword", feedback: "currentPassword" }] as const;
      return fail(400, emailAction({ status: "validation-error", issues }, input.value.email));
    }
    const { status, feedback } = serviceFeedback(error);
    return fail(status, emailAction({ status: "service-error", feedback }, input.value.email));
  }

  return emailAction({ status: "pending-email" });
}

/** Cancels the email change awaiting confirmation, so its link confirms nothing. */
async function cancelEmailUpdate(event: RequestEvent) {
  try {
    const { authentication, session } = await requireAuthorization(event);
    await shortCodeCancelEmailUpdate(authentication.api, session.accessToken);
  } catch (error) {
    rethrowRefusal(error);

    // A change confirmed or expired since the page loaded, or replaced during the request, leaves nothing to cancel.
    if (!isHttpStatusError(error, 404)) {
      const { status, feedback } = serviceFeedback(error);
      return fail(status, { accountAction: { kind: "cancelEmail", state: { status: "service-error", feedback } } });
    }
  }

  closeEditor(event);
}

function usernameAction(editor: UsernameEditor): AccountActionData {
  return { accountAction: { kind: "username", editor } };
}

function pictureAction(editor: PictureEditor): AccountActionData {
  return { accountAction: { kind: "picture", editor } };
}

/** Sends the visitor back to the tab with its dialogs closed, where it shows the change. */
function closeEditor(event: RequestEvent): never {
  redirect(303, localHref(dialogUrl(event.url, editorParameter, null)));
}

/**
 * Sets the username, or clears it when left empty. The service's rule decides; a refusal names the
 * rule the platform's mirror finds broken, if any.
 */
async function updateUsername(event: RequestEvent) {
  const draft = textValue(await event.request.formData(), "username");

  try {
    const { session } = await requireAuthorization(event);
    await profileUsernameUpdate(getProfileContext(event).api, session.accessToken, { username: draft });
  } catch (error) {
    rethrowRefusal(error);

    // Profile answers 422 for a refused username, and 400 before its 422 release.
    if (isHttpStatusError(error, 400, 413, 422)) {
      const issue = usernameIssue(draft) ?? "refused";
      return fail(400, usernameAction({ draft, state: { status: "validation-error", issue } }));
    }
    const { status, feedback } = serviceFeedback(error);
    return fail(status, usernameAction({ draft, state: { status: "service-error", feedback } }));
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
    rethrowRefusal(error);

    if (isHttpStatusError(error, 413, 422)) {
      return fail(422, pictureAction({ status: "choosing", refusal: pictureRefusal(error) }));
    }
    const { status, feedback } = serviceFeedback(error);
    return fail(status, pictureAction({ status: "service-error", feedback }));
  }

  closeEditor(event);
}

/** Removes the picture. A profile that holds none has nothing to remove. */
async function removePicture(event: RequestEvent) {
  try {
    const { session } = await requireAuthorization(event);
    await profilePictureDelete(getProfileContext(event).api, session.accessToken);
  } catch (error) {
    rethrowRefusal(error);

    if (!isHttpStatusError(error, 404)) {
      const { status, feedback } = serviceFeedback(error);
      return fail(status, pictureAction({ status: "service-error", feedback }));
    }
  }

  closeEditor(event);
}

/** The tab's form actions. Each account change checks the session again before calling the service. */
export const actions = {
  password: changePassword,
  email: requestEmailUpdate,
  cancelEmail: cancelEmailUpdate,
  username: updateUsername,
  picture: updatePicture,
  removePicture,
};
