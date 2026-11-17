import type { AuthenticationJourney, AuthenticationPanelModel } from "./controller.svelte";

import type { TFunction } from "i18next";

function journeyTitle(t: TFunction<"common">, journey: AuthenticationJourney) {
  switch (journey) {
    case "login":
      return t("shell.auth.login.title");
    case "register":
      return t("shell.auth.register.title");
    case "reset":
      return t("pageTitles.resetPassword");
  }
}

/** Labels the active authentication task without exposing the submitted email address. */
export function authenticationPageTitle(t: TFunction<"common">, { journey, state }: AuthenticationPanelModel) {
  const title = journeyTitle(t, journey);
  if (state.status === "recorded") return t("shell.auth.register.recordedTitle");
  if (state.status === "pending-email")
    return t("pageTitles.withState", { title, status: t("shell.auth.pendingTitle") });
  if (state.status === "service-error") return t("pageTitles.withState", { title, status: t("form.unavailableTitle") });
  return title;
}
