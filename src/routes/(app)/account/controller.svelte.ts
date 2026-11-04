import type { AccountSummaryState } from "#lib/application/auth/types.js";

/** The account tabs, each a page under the account layout. */
export type AccountTab = "information" | "devices" | "privacy";

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
  /** Reconciles a completed load or navigation with the rendered layout. */
  synchronize(summary: AccountSummaryState, currentTab: AccountTab | null): void;
  /** Starts a logout and reports whether native submission may continue. */
  submitLogout(): boolean;
}

/** Configuration for the default account layout controller. */
export type AccountLayoutControllerOptions = Omit<AccountLayoutControllerState, "logoutState">;

/** Creates a reactive controller for the account layout. */
export function createAccountLayoutController({
  summary: initialSummary,
  logoutAction,
  pictureEditorHref,
  tabs,
  currentTab: initialTab,
}: AccountLayoutControllerOptions): AccountLayoutController {
  let summary = $state(initialSummary);
  let currentTab = $state(initialTab);
  let logoutState = $state<"ready" | "submitting">("ready");

  return {
    get state() {
      return { summary, logoutState, logoutAction, pictureEditorHref, tabs, currentTab };
    },
    synchronize(nextSummary, nextTab) {
      summary = nextSummary;
      currentTab = nextTab;
    },
    submitLogout() {
      if (logoutState === "submitting") return false;
      logoutState = "submitting";
      return true;
    },
  };
}
