import type {
  AccountDeviceConfirmation,
  AccountDevicesActions,
  AccountDevicesModel,
} from "#lib/application/auth/types.js";

import type { OpenController } from "@a-novel-kit/uikit";

/** State rendered by the devices tab. */
export interface AccountDevicesControllerState {
  model: AccountDevicesModel;
  actions: AccountDevicesActions;
  /** The privacy tab, where the account turns locations on. */
  privacyHref: string;
}

/** Pure state and transitions of the devices tab. */
export interface AccountDevicesController {
  readonly state: AccountDevicesControllerState;
  /** The logout confirmation dialog, open while the URL names a logout. */
  readonly confirmation: OpenController;
  /** Native navigation destination that asks to confirm a logout, or closes the dialog for null. */
  confirmationHref(confirmation: AccountDeviceConfirmation | null): string;
  /** Asks to confirm a logout in place of following its link. */
  openConfirmation(confirmation: AccountDeviceConfirmation): void;
  /** Reconciles a completed load or action with the rendered tab. */
  synchronize(model: AccountDevicesModel): void;
  /** Starts a device change and reports whether native submission may continue. */
  submitChange(): boolean;
}

/** Configuration for the default devices controller. */
export interface AccountDevicesControllerOptions extends AccountDevicesControllerState {
  /** Allows the browser to submit forms after the controller accepts their transition. */
  allowNativeSubmission?: boolean;
  /** Observes accepted confirmation changes, which the route mirrors in the URL. */
  onConfirmationChange?: (confirmation: AccountDeviceConfirmation | null) => void;
  /** Builds the URL of a confirmation change, from the current route. */
  confirmationUrl?: (confirmation: AccountDeviceConfirmation | null) => string;
}

/** Creates a reactive controller for the devices tab. */
export function createAccountDevicesController({
  model: initialModel,
  actions,
  privacyHref,
  allowNativeSubmission = true,
  onConfirmationChange,
  confirmationUrl = (confirmation) =>
    confirmation ? `?confirm=${confirmation.kind === "others" ? "others" : confirmation.id}` : "?",
}: AccountDevicesControllerOptions): AccountDevicesController {
  let model = $state(initialModel);

  function setConfirmation(confirmation: AccountDeviceConfirmation | null) {
    model = { ...model, confirmation };
    onConfirmationChange?.(confirmation);
  }

  return {
    get state() {
      return { model, actions, privacyHref };
    },
    confirmation: {
      get state() {
        return { open: model.confirmation !== null };
      },
      open: () => {},
      close: () => setConfirmation(null),
      toggle: () => setConfirmation(null),
    },
    confirmationHref: confirmationUrl,
    openConfirmation: setConfirmation,
    synchronize(next) {
      model = next;
    },
    submitChange() {
      if (model.action.status === "submitting") return false;
      model = { ...model, action: { status: "submitting" } };
      return allowNativeSubmission;
    },
  };
}
