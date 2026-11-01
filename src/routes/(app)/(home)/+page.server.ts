import { authenticationActions } from "#lib/server/auth/authentication-route.js";

import type { Actions, PageServerLoad } from "./$types";

import { redirect } from "@sveltejs/kit";

// The account page is the platform's only screen, so a signed-in visitor goes straight to it.
export const load: PageServerLoad = async ({ parent }) => {
  const { session } = await parent();
  if (session.status === "authenticated") redirect(303, "/account");
};

export const actions: Actions = authenticationActions;
