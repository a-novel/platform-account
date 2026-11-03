import { loadShortCodeRoute, submitShortCodeRoute } from "../../short-code.server";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = (event) => loadShortCodeRoute("email-update", event);

export const actions: Actions = {
  default: async (event) => await submitShortCodeRoute("email-update", event),
};
