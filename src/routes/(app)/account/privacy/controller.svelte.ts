import type { AuthenticationFeedback } from "#lib/application/auth/types.js";

import type { SwitchController } from "@a-novel-kit/uikit";

/** The account's location consent on the privacy tab, with the outcome of the latest change. */
export type PrivacyAccountState =
  { status: "ready"; locationConsent: boolean; feedback?: AuthenticationFeedback } | { status: "unavailable" };

/** The account's location consent and its switch, which submits each change. */
export interface LocationConsentController {
  readonly account: PrivacyAccountState;
  /** Set while a change is on its way to the server. */
  readonly pending: boolean;
  readonly consent: SwitchController;
}

/**
 * Creates the controller of the privacy page's account section, from the consent the route loads or the
 * result its last change returned.
 */
export function createLocationConsentController(getAccount: () => PrivacyAccountState): LocationConsentController {
  // The switch's answer shows, pending, until the next load or action result replaces it.
  let answer = $derived({ account: getAccount(), pending: false });

  function setChecked(checked: boolean) {
    if (answer.account.status !== "ready" || answer.pending) return;
    answer = { account: { status: "ready", locationConsent: checked }, pending: true };
  }

  return {
    get account() {
      return answer.account;
    },
    get pending() {
      return answer.pending;
    },
    consent: {
      get state() {
        return { checked: answer.account.status === "ready" && answer.account.locationConsent };
      },
      setChecked,
      toggle: () => setChecked(!(answer.account.status === "ready" && answer.account.locationConsent)),
    },
  };
}
