import type { AccountSummaryState } from "#lib/application/auth/types.js";

/** The account tabs, each a page under the account layout. */
export type AccountTab = "information" | "devices" | "privacy" | "preferences";

/** State rendered by the account layout: the header and the tab bar. */
export interface AccountLayoutControllerState {
  summary: AccountSummaryState;
  logoutState: "ready" | "submitting";
  /** Where the header's logout posts. */
  logoutAction: string;
  /** The information tab with the picture's editor open, which the header's picture opens. */
  pictureEditorHref: string;
  /** Each tab's page, by tab. */
  tabs: Record<AccountTab, string>;
  /** The tab showing, or null on a page the tab bar does not list. */
  currentTab: AccountTab | null;
}

/** Pure state and transitions of the account layout. */
export interface AccountLayoutController {
  readonly state: AccountLayoutControllerState;
  /** Starts a logout and reports whether native submission may continue. */
  submitLogout(): boolean;
}

/** Configuration for the default account layout controller. */
export interface AccountLayoutControllerOptions extends Pick<
  AccountLayoutControllerState,
  "logoutAction" | "pictureEditorHref" | "tabs"
> {
  /** The account the layout loads, which each load replaces. */
  getSummary: () => AccountSummaryState;
  /** The tab showing, which each navigation may change. */
  getCurrentTab: () => AccountTab | null;
}

/** Creates a reactive controller for the account layout. */
export function createAccountLayoutController({
  getSummary,
  logoutAction,
  pictureEditorHref,
  tabs,
  getCurrentTab,
}: AccountLayoutControllerOptions): AccountLayoutController {
  let logoutState = $state<"ready" | "submitting">("ready");
  const state = $derived({
    summary: getSummary(),
    logoutState,
    logoutAction,
    pictureEditorHref,
    tabs,
    currentTab: getCurrentTab(),
  });

  return {
    get state() {
      return state;
    },
    submitLogout() {
      if (logoutState === "submitting") return false;
      logoutState = "submitting";
      return true;
    },
  };
}
