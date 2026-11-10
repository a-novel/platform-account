import { validateEmailRequest, validateInvitationRequest, validateLogin } from "#lib/application/auth/forms.js";
import { returnsToAuthorization } from "#lib/application/auth/navigation.js";
import type { AuthenticationJourney, AuthenticationPanelModel } from "#lib/application/auth/types.js";
import type { AuthDialogView, ShellApps, ShellViewModel } from "#lib/application/shell/types.js";
import type { PlatformDowntime } from "#lib/ui/downtime.svelte.js";

import { readAuthView, withAuthView } from "./auth-dialog-state";
import { readNavigationOpen, withNavigationOpen } from "./navigation-state";

import { SvelteURL } from "svelte/reactivity";

import type { OpenController, PasswordInputController } from "@a-novel-kit/uikit";

/** State rendered by the account shell component. */
export interface ShellControllerState {
  model: ShellViewModel;
  homeHref: string;
  accountHref: string;
  /** The Privacy page, absent on a platform that collects no browser telemetry and so asks nothing. */
  privacyHref: string | null;
  logoutAction: string;
  /** The app list, absent while the server cannot read where the apps live. */
  apps: ShellApps | null;
  /** The planned downtime the shell announces and locks the sign-in dialog for, absent where nothing tracks it. */
  platformDowntime?: PlatformDowntime;
}

/** The layout's load data the shell renders: the page's destination, the session, the rail and the app list. */
export type ShellData = Pick<ShellViewModel, "activeNavigation" | "session" | "rail"> &
  Pick<ShellControllerState, "apps">;

/** Pure state and transitions consumed by the account shell component. */
export interface ShellController {
  readonly state: ShellControllerState;
  readonly authentication: AuthenticationPanelController;
  readonly authenticationDialog: OpenController;
  readonly navigationDialog: OpenController;
  /** Native navigation destination for the mobile menu. */
  navigationHref(open: boolean): string;
  /** Native navigation destination for an authentication view or its dismissal, with the mobile menu closed. */
  authenticationHref(view: AuthDialogView | null): string;
  /** Shows one authentication journey in place of the mobile menu. */
  openAuthentication(view: AuthDialogView): void;
  /** Switches between the expanded and collapsed navigation rail. */
  toggleRail(): void;
  /** Requests logout and reports whether native form submission should continue. */
  logout(): boolean;
}

/** Configuration for the default account shell controller. */
export interface ShellControllerOptions extends Omit<ShellControllerState, "model" | "apps"> {
  /** The layout's load data, which each navigation may replace. */
  getData: () => ShellData;
  authentication: AuthenticationPanelController;
  /** Allows the browser to submit the logout form after the controller accepts it. */
  allowNativeLogout?: boolean;
  /** Observes accepted authentication-view changes. */
  onAuthViewChange?: (view: AuthDialogView | null) => void;
  /** Observes accepted navigation-rail changes. */
  onRailChange?: (rail: ShellViewModel["rail"]) => void;
  /** Observes accepted mobile-menu changes. */
  onDrawerChange?: (open: boolean) => void;
  /**
   * Current base-resolved route, including query and fragment state. It owns the mobile menu, the authentication
   * view and the authorization request.
   */
  getUrl?: () => URL;
  /** Tells whether the page needs a login, which keeps the dialog open over it. */
  getAuthLocked?: () => boolean;
}

/** Creates a reactive controller for the account application shell. */
export function createShellController({
  getData,
  homeHref,
  accountHref,
  privacyHref,
  logoutAction,
  platformDowntime,
  authentication,
  allowNativeLogout = true,
  onAuthViewChange,
  onRailChange,
  onDrawerChange,
  getUrl = () => new SvelteURL(homeHref, "https://account.invalid"),
  getAuthLocked = () => false,
}: ShellControllerOptions): ShellController {
  // The rail the server read from the visitor's cookie, until they toggle it.
  let rail = $derived(getData().rail);
  // The URL owns the menu and the dialog: a transition changes them at once, and the next URL, such as Back's,
  // decides again.
  let drawerOpen = $derived(readNavigationOpen(getUrl().searchParams));
  let authView = $derived(readAuthView(getUrl().searchParams) ?? (getAuthLocked() ? "login" : null));
  // A logout the browser does not submit signs the shell out until the next load.
  let session = $derived(getData().session);

  const state = $derived.by((): ShellControllerState => {
    const { activeNavigation, apps } = getData();
    const authorizationRequest = returnsToAuthorization(getUrl().searchParams.get("returnTo"));
    return {
      model: {
        activeNavigation,
        rail,
        drawerOpen,
        authView,
        session,
        authorizationRequest,
        authLocked: getAuthLocked(),
      },
      homeHref,
      accountHref,
      privacyHref,
      logoutAction,
      apps,
      platformDowntime,
    };
  });

  function setDrawerOpen(open: boolean) {
    if (drawerOpen === open) return;
    drawerOpen = open;
    onDrawerChange?.(open);
  }

  function setAuthentication(view: AuthDialogView | null) {
    if (authView === view || (view === null && getAuthLocked())) return;
    authView = view;
    onAuthViewChange?.(view);
  }

  function href(url: URL) {
    return url.pathname + url.search + url.hash;
  }

  const authenticationDialog: OpenController = {
    get state() {
      return { open: authView !== null };
    },
    open: () => setAuthentication(authView ?? "login"),
    close: () => setAuthentication(null),
    toggle: () => setAuthentication(authView === null ? "login" : null),
  };

  const navigationDialog: OpenController = {
    get state() {
      return { open: drawerOpen };
    },
    open: () => setDrawerOpen(true),
    close: () => setDrawerOpen(false),
    toggle: () => setDrawerOpen(!drawerOpen),
  };

  return {
    get state() {
      return state;
    },
    authentication,
    authenticationDialog,
    navigationDialog,
    navigationHref: (open) => href(withNavigationOpen(getUrl(), open)),
    authenticationHref: (view) => href(withAuthView(withNavigationOpen(getUrl(), false), view)),
    openAuthentication(view) {
      setDrawerOpen(false);
      setAuthentication(view);
    },
    toggleRail() {
      rail = rail === "expanded" ? "collapsed" : "expanded";
      onRailChange?.(rail);
    },
    logout() {
      if (session.status === "anonymous") return false;
      if (!allowNativeLogout) session = { status: "anonymous" };
      return allowNativeLogout;
    },
  };
}

/** Creates the ready authentication model shared by shell controllers and stories. */
export function readyAuthenticationModel(view: AuthDialogView): AuthenticationPanelModel {
  return { journey: view, state: { status: "ready" } } as AuthenticationPanelModel;
}

const validators = {
  login: validateLogin,
  register: validateInvitationRequest,
  reset: validateEmailRequest,
} satisfies Record<AuthenticationJourney, unknown>;

/** A form in one of these statuses is sending or done, and ignores another submission. */
const lockedStatuses = new Set(["submitting", "pending-email", "recorded"]);

/** State rendered by the authentication form component. */
export interface AuthenticationPanelControllerState {
  model: AuthenticationPanelModel;
  action: string;
  /** Set while a planned downtime stops the service these forms need. */
  maintenance?: boolean;
}

/** Pure authentication-form state and transitions. */
export interface AuthenticationPanelController {
  readonly state: AuthenticationPanelControllerState;
  /** Shows or hides the password; every new route state masks it again. */
  readonly passwordVisibility: PasswordInputController;
  /** Validates submitted values, exposes field issues in state, and allows valid native submission. */
  submit(form: FormData): boolean;
}

/** Configuration for the default authentication-form controller. */
export interface AuthenticationPanelControllerOptions {
  /** The form the route shows: the latest action result for its journey, or a blank form, and where it posts. */
  getState: () => AuthenticationPanelControllerState;
  /** Allows the browser to submit the form after the controller accepts the transition. */
  allowNativeSubmission?: boolean;
}

/** Creates a reactive controller for a shell authentication form. */
export function createAuthenticationPanelController({
  getState,
  allowNativeSubmission = true,
}: AuthenticationPanelControllerOptions): AuthenticationPanelController {
  // A submission edits the form until the route shows another one, which also masks the password again.
  let form = $derived({ ...getState(), passwordShown: false });
  const state = $derived({ model: form.model, action: form.action, maintenance: form.maintenance });

  function setStatus(status: AuthenticationPanelModel["state"]) {
    form = { ...form, model: { ...form.model, state: status } as AuthenticationPanelModel };
  }

  return {
    get state() {
      return state;
    },
    passwordVisibility: {
      get state() {
        return { pressed: form.passwordShown };
      },
      setPressed: (pressed) => (form = { ...form, passwordShown: pressed }),
      toggle: () => (form = { ...form, passwordShown: !form.passwordShown }),
    },
    submit(data) {
      if (form.maintenance || lockedStatuses.has(form.model.state.status)) return false;

      const result = validators[form.model.journey](data);
      if (!result.success) {
        setStatus({ status: "validation-error", issues: result.issues } as AuthenticationPanelModel["state"]);
        return false;
      }
      setStatus({ status: "submitting" });
      return allowNativeSubmission;
    },
  };
}
