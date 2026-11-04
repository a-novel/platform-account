import { getAuthenticationContext } from "#lib/server/auth/context.js";
import { getProfileContext } from "#lib/server/profile/context.js";

import type { RequestHandler } from "./$types";

import { isHttpStatusError } from "@a-novel-kit/nodelib-browser/http";
import { ProfilePictureGetRequestSchema, profilePictureGet } from "@a-novel/service-profile-rest";

/**
 * Serves a profile's picture from the profile service, which any visitor's token reads. The `v`
 * parameter names the picture's version, so a URL that carries it keeps one image for good.
 */
export const GET: RequestHandler = async (event) => {
  const request = ProfilePictureGetRequestSchema.safeParse({ id: event.params.id });
  if (!request.success) return new Response(null, { status: 404 });

  try {
    // A visitor without a session gets an anonymous one, which their later pictures reuse.
    const accessToken = await getAuthenticationContext(event).session.anonymousAccessToken();
    const picture = await profilePictureGet(getProfileContext(event).api, accessToken, request.data);

    return new Response(picture, {
      headers: {
        "cache-control": event.url.searchParams.has("v") ? "public, max-age=31536000, immutable" : "no-cache",
        "content-type": picture.type,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return new Response(null, { status: isHttpStatusError(error, 404) ? 404 : 503 });
  }
};
