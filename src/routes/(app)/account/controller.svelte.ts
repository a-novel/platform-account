import type { ProfileSummary } from "#lib/application/profile/types.js";

/** What the account pages' header states about the visitor. */
export interface AccountSummary {
  roles: readonly string[];
  /** The current email, absent while Authentication cannot report it. A pending change stays out. */
  email?: string;
  /** The initials an account without a picture shows, from its email's handle as the shell's. */
  initials?: string;
  /** When the visitor must log in again, formatted: the refresh token's expiry. */
  loggedInUntil?: string;
  /** The public profile, absent while the profile service cannot report it. */
  profile?: ProfileSummary;
}

/** The header's state, independent of the tabs below it. */
export type AccountSummaryState = ({ status: "ready" } & AccountSummary) | { status: "loading" };

/** The account's email, its change awaiting confirmation and its location consent, as Authentication reports them. */
export interface AccountCredentialsSummary {
  email: string;
  pendingEmail?: { email: string; expiresAt: string };
  /** Whether the account records the IP address and approximate location of its devices. */
  locationConsent: boolean;
}

/** Credentials availability, independent of the account forms. */
export type AccountCredentialsState = ({ status: "ready" } & AccountCredentialsSummary) | { status: "unavailable" };

/** The visitor's public profile, independent of their credentials. */
export type ProfileState = ({ status: "ready" } & ProfileSummary) | { status: "unavailable" };

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
