import { authorize } from "#lib/server/auth/authorize.js";

import type { PageServerLoad } from "./$types";

// Every authorization request ends in a redirect or the error page, so the route renders no page of its own.
export const load: PageServerLoad = authorize;
