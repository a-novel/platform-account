import type { AuthenticationFeedback } from "#lib/application/auth/types.js";

import type { DeviceList } from "./device-pages";

import type { OpenController } from "@a-novel-kit/uikit";

/** What a device's User-Agent tells: its browser and system when recognized, and its form factor. */
export interface DeviceName {
  browser?: string;
  system?: string;
  form: "desktop" | "phone" | "tablet";
}

/** A device the account logged in on: one session, as the devices tab lists it. */
export interface AccountDevice extends DeviceName {
  /** The session the device holds, which logging it out or removing it names. */
  id: string;
  /** Marks the device showing the page. */
  current: boolean;
  /** Set once the device was logged out or its session ended. */
  loggedOut: boolean;
  /** When the device's latest access token was issued, formatted for the reader. */
  lastActiveAt: string;
  /** The approximate place, formatted for the reader, when the account records locations. */
  place?: string;
  ipAddress?: string;
}

/** A logout waiting for the reader's confirmation: one device, or every device but this one. */
export type AccountDeviceConfirmation = { kind: "device"; id: string } | { kind: "others" };

/** The devices tab: the account's devices and the outcome of the latest change. */
export interface AccountDevicesModel {
  /** Loading while retries run after a failed read, and unavailable once they run out. */
  devices: { status: "ready"; devices: AccountDevice[] } | { status: "loading" } | { status: "unavailable" };
  /** The page each list shows, which the URL owns. The first without one. */
  pages?: { active: number; loggedOut: number };
  /** Whether the account records locations, or null when Authentication cannot tell. */
  locationConsent: boolean | null;
  /** The logout the open confirmation dialog asks about, which the URL owns. */
  confirmation: AccountDeviceConfirmation | null;
  action:
    | { status: "ready" | "submitting" | "logged-out" | "logged-out-others" | "removed" }
    | { status: "service-error"; feedback: AuthenticationFeedback };
}

/** POST destinations of the devices tab. */
export interface AccountDevicesActions {
  logoutDevice: string;
  logoutOtherDevices: string;
  removeDevice: string;
  /** Logs this device out, through the shell's logout. */
  logout: string;
}

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
  /** Native navigation destination that shows one page of a list. */
  pageHref(list: DeviceList, page: number): string;
  /** Asks to confirm a logout in place of following its link. */
  openConfirmation(confirmation: AccountDeviceConfirmation): void;
  /** Starts a device change and reports whether native submission may continue. */
  submitChange(): boolean;
}

/** Configuration for the default devices controller. */
export interface AccountDevicesControllerOptions extends Omit<AccountDevicesControllerState, "model"> {
  /** The tab the route loads, with the last action's result. Each load and action replaces it. */
  getModel: () => Omit<AccountDevicesModel, "confirmation">;
  /** The logout the URL asks to confirm, which Back and Forward change. */
  getConfirmation: () => AccountDeviceConfirmation | null;
  /** Allows the browser to submit forms after the controller accepts their transition. */
  allowNativeSubmission?: boolean;
  /** Observes accepted confirmation changes, which the route mirrors in the URL. */
  onConfirmationChange?: (confirmation: AccountDeviceConfirmation | null) => void;
  /** Builds the URL of a confirmation change, from the current route. */
  confirmationUrl?: (confirmation: AccountDeviceConfirmation | null) => string;
  /** Builds the URL of one page of a list, from the current route. */
  pageUrl?: (list: DeviceList, page: number) => string;
}

/** Creates a reactive controller for the devices tab. */
export function createAccountDevicesController({
  getModel,
  getConfirmation,
  actions,
  privacyHref,
  allowNativeSubmission = true,
  onConfirmationChange,
  confirmationUrl = (confirmation) =>
    confirmation ? `?confirm=${confirmation.kind === "others" ? "others" : confirmation.id}` : "?",
  pageUrl = (list, page) => `?${list === "active" ? "page" : "loggedOutPage"}=${page}`,
}: AccountDevicesControllerOptions): AccountDevicesController {
  // A transition opens or closes the confirmation at once, and the next URL, such as Back's, decides again.
  let confirmation = $derived(getConfirmation());
  // A submission shows until the next load or action result.
  let action = $derived(getModel().action);
  const state = $derived({ model: { ...getModel(), confirmation, action }, actions, privacyHref });

  function setConfirmation(next: AccountDeviceConfirmation | null) {
    confirmation = next;
    onConfirmationChange?.(next);
  }

  return {
    get state() {
      return state;
    },
    confirmation: {
      get state() {
        return { open: confirmation !== null };
      },
      open: () => {},
      close: () => setConfirmation(null),
      toggle: () => setConfirmation(null),
    },
    confirmationHref: confirmationUrl,
    pageHref: pageUrl,
    openConfirmation: setConfirmation,
    submitChange() {
      if (action.status === "submitting") return false;
      action = { status: "submitting" };
      return allowNativeSubmission;
    },
  };
}
