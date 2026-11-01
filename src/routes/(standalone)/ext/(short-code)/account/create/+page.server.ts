import { loadShortCodeRoute, submitShortCodeRoute } from "#lib/server/auth/short-code-route.js";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = (event) => loadShortCodeRoute("register", event);

export const actions: Actions = {
  default: async (event) => await submitShortCodeRoute("register", event),
};
