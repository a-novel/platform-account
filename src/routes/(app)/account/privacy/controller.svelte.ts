import type { PrivacyAccountState } from "#lib/application/auth/types.js";

import type { SwitchController } from "@a-novel-kit/uikit";

/** The account's location consent and its switch, which submits each change. */
export interface LocationConsentController {
  /** The account's consent, or null for a logged-out visitor. */
  readonly account: PrivacyAccountState | null;
  /** Set while a change is on its way to the server. */
  readonly pending: boolean;
  readonly consent: SwitchController;
  /** Reconciles a completed load or action with the rendered consent. */
  synchronize(account: PrivacyAccountState | null): void;
}

/** Creates the controller of the privacy page's account section. */
export function createLocationConsentController(initial: PrivacyAccountState | null): LocationConsentController {
  let account = $state(initial);
  let pending = $state(false);

  function setChecked(checked: boolean) {
    if (account?.status !== "ready" || pending) return;
    account = { status: "ready", locationConsent: checked };
    pending = true;
  }

  return {
    get account() {
      return account;
    },
    get pending() {
      return pending;
    },
    consent: {
      get state() {
        return { checked: account?.status === "ready" && account.locationConsent };
      },
      setChecked,
      toggle: () => setChecked(!(account?.status === "ready" && account.locationConsent)),
    },
    synchronize(next) {
      account = next;
      pending = false;
    },
  };
}
