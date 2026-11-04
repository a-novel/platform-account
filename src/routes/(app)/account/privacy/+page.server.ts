import type { PrivacyAccountState } from "#lib/application/auth/types.js";
import { requireAuthorization } from "#lib/server/auth/authorization.js";

import type { PageServerLoadEvent } from "./$types";

import { isHttpStatusError } from "@a-novel-kit/nodelib-browser/http";
import { credentialsUpdateLocationConsent } from "@a-novel/service-authentication-rest";

import type { RequestEvent } from "@sveltejs/kit";
import { fail, isHttpError, isRedirect } from "@sveltejs/kit";

/** Reads the account's location consent from the credentials the account layout loaded. */
export const load = async ({ parent }: PageServerLoadEvent) => {
  const { credentials } = await parent();
  const account: PrivacyAccountState =
    credentials.status === "ready"
      ? { status: "ready", locationConsent: credentials.locationConsent }
      : { status: "unavailable" };
  return { account };
};

/** Records the account's location consent. Turning it off erases every location the account holds. */
async function changeLocationConsent(event: RequestEvent) {
  const enabled = (await event.request.formData()).get("enabled") === "on";

  try {
    const { authentication, session } = await requireAuthorization(event);
    await credentialsUpdateLocationConsent(authentication.api, session.accessToken, { enabled });
  } catch (error) {
    if (isRedirect(error) || isHttpError(error, 403)) throw error;

    const tooMany = isHttpStatusError(error, 429);
    const account = {
      status: "ready",
      locationConsent: !enabled,
      feedback: tooMany ? "tooManyAttempts" : "serviceUnavailable",
    } satisfies PrivacyAccountState;
    return fail(tooMany ? 429 : 503, { account });
  }

  return { account: { status: "ready", locationConsent: enabled } satisfies PrivacyAccountState };
}

export const actions = { locationConsent: changeLocationConsent };
