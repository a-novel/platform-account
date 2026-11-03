import { getAuthenticationContext } from "#lib/server/auth/context.js";
import type { AuthenticationEvent } from "#lib/server/auth/context.js";
import { resolve } from "$app/paths";

import { redirect } from "@sveltejs/kit";

/**
 * Sends a logged-in visitor to their account's privacy tab. The page stays public for everyone else, who can
 * change this device's answer without an account.
 */
export const load = async (event: AuthenticationEvent) => {
  let loggedIn = false;
  try {
    loggedIn = (await getAuthenticationContext(event).session.authenticated()) !== null;
  } catch {
    // An unchecked session shows the public page, which needs none.
  }

  if (loggedIn) redirect(307, resolve("/(app)/account/privacy"));
};
