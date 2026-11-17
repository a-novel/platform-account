import type { TFunction } from "i18next";

/** Uses a readable error description instead of a bare HTTP status in the tab. */
export function errorPageTitle(t: TFunction<"common">, status: number, downtime = false, authorizationRequest = false) {
  if (downtime) return t("access.downtime.title");
  if (authorizationRequest) return t("access.authorizationRequest.title");

  switch (status) {
    case 401:
      return t("shell.auth.login.title");
    case 404:
      return t("access.notFound.title");
    case 403:
      return t("access.forbidden.title");
    case 503:
      return t("access.unavailable.title");
    default:
      return t("access.error.title");
  }
}
