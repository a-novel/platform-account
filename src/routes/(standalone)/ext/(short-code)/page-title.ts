import type { ShortCodeJourney, ShortCodeScreenModel } from "./controller.svelte";

import type { TFunction } from "i18next";

function journeyTitle(t: TFunction<"common">, journey: ShortCodeJourney) {
  switch (journey) {
    case "register":
      return t("pageTitles.createAccount");
    case "password-reset":
      return t("pageTitles.resetPassword");
    case "email-update":
      return t("pageTitles.confirmEmail");
  }
}

/** Keeps the secure-link task identifiable after completion or a rejected link. */
export function shortCodePageTitle(t: TFunction<"common">, { journey, state }: ShortCodeScreenModel) {
  const title = journeyTitle(t, journey);
  switch (state.status) {
    case "success":
      if (journey === "register") return t("pageTitles.accountCreated");
      return journey === "password-reset" ? t("pageTitles.passwordReset") : t("pageTitles.emailUpdated");
    case "missing":
      return t("pageTitles.withState", { title, status: t("pageTitles.incompleteLink") });
    case "invalid":
      return t("pageTitles.withState", { title, status: t("pageTitles.invalidLink") });
    case "service-error":
      return t("pageTitles.withState", { title, status: t("form.unavailableTitle") });
    default:
      return title;
  }
}
