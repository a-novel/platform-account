import { loadShortCodeRoute, submitShortCodeRoute } from "../../short-code.server";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = (event) => loadShortCodeRoute("password-reset", event);

export const actions: Actions = {
  default: async (event) => await submitShortCodeRoute("password-reset", event),
};
