import { requireAuthorization, rethrowRefusal } from "#lib/server/auth/authorization.js";
import { serviceFeedback } from "#lib/server/service-fetch.js";

import type { PageServerLoadEvent } from "./$types";
import type { PrivacyAccountState } from "./controller.svelte";

import { credentialsUpdateLocationConsent } from "@a-novel/service-authentication-rest";

import type { RequestEvent } from "@sveltejs/kit";
import { fail } from "@sveltejs/kit";

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
    rethrowRefusal(error);

    const { status, feedback } = serviceFeedback(error);
    return fail(status, {
      account: { status: "ready", locationConsent: !enabled, feedback } satisfies PrivacyAccountState,
    });
  }

  return { account: { status: "ready", locationConsent: enabled } satisfies PrivacyAccountState };
}

export const actions = { locationConsent: changeLocationConsent };
