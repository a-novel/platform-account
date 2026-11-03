import { validateEmailRequest, validateInvitationRequest, validateLogin } from "#lib/application/auth/forms.js";
import type { AuthenticationJourney, AuthenticationPanelModel } from "#lib/application/auth/types.js";
import type { AuthDialogView, ShellApps, ShellSession, ShellViewModel } from "#lib/application/shell/types.js";
import type { PlatformDowntime } from "#lib/ui/downtime.svelte.js";

import { withAuthView } from "./auth-dialog-state";
import { withNavigationOpen } from "./navigation-state";

import { SvelteURL } from "svelte/reactivity";

import { type OpenController, type PasswordInputController, createPressedController } from "@a-novel-kit/uikit";

/** State rendered by the account shell component. */
export interface ShellControllerState {
  model: ShellViewModel;
  homeHref: string;
  accountHref: string;
  logoutAction: string;
  /** The Privacy page, absent on a platform that collects no browser telemetry and so asks nothing. */
  privacyHref: string | null;
  /** The app list, absent while the server cannot read where the apps live. */
  apps: ShellApps | null;
  /** The planned downtime the shell announces and locks the sign-in dialog for, absent where nothing tracks it. */
  platformDowntime?: PlatformDowntime;
}

/** Route-owned state synchronized into the shell after navigation. */
export interface ShellRouteState {
  activeNavigation: ShellViewModel["activeNavigation"];
  session: ShellSession;
  drawerOpen?: boolean;
  authView: AuthDialogView | null;
  authorizationRequest?: boolean;
  authentication?: AuthenticationPanelControllerState;
}

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
  /** Reconciles route-owned state after navigation or form actions. */
  synchronizeRoute(state: ShellRouteState): void;
  /** Reconciles the persisted navigation-rail preference. */
  synchronizeRail(rail: ShellViewModel["rail"]): void;
}

/** Configuration for the default account shell controller. */
export interface ShellControllerOptions extends ShellControllerState {
  authentication: AuthenticationPanelController;
  /** Resolves the form state used when the user selects an authentication journey. */
  resolveAuthentication?: (view: AuthDialogView) => AuthenticationPanelControllerState;
  /** Allows the browser to submit the logout form after the controller accepts it. */
  allowNativeLogout?: boolean;
  /** Observes accepted authentication-view changes. */
  onAuthViewChange?: (view: AuthDialogView | null) => void;
  /** Observes accepted navigation-rail changes. */
  onRailChange?: (rail: ShellViewModel["rail"]) => void;
  /** Observes accepted mobile-menu changes. */
  onDrawerChange?: (open: boolean) => void;
  /** Current base-resolved route, including query and fragment state. */
  getUrl?: () => URL;
}

/** Creates a reactive controller for the account application shell. */
export function createShellController({
  model: initialModel,
  homeHref,
  accountHref,
  logoutAction,
  privacyHref,
  apps,
  platformDowntime,
  authentication,
  resolveAuthentication,
  allowNativeLogout = true,
  onAuthViewChange,
  onRailChange,
  onDrawerChange,
  getUrl = () => new SvelteURL(homeHref, "https://account.invalid"),
}: ShellControllerOptions): ShellController {
  let model = $state(initialModel);

  function setDrawerOpen(open: boolean) {
    if (model.drawerOpen === open) return;
    model = { ...model, drawerOpen: open };
    onDrawerChange?.(open);
  }

  function setAuthentication(view: AuthDialogView | null) {
    if (model.authView === view) return;

    model = { ...model, authView: view };
    if (view) {
      const nextAuthentication = resolveAuthentication?.(view);
      if (nextAuthentication) authentication.synchronize(nextAuthentication.model, nextAuthentication.action);
    }
    onAuthViewChange?.(view);
  }

  function href(url: URL) {
    return url.pathname + url.search + url.hash;
  }

  const authenticationDialog: OpenController = {
    get state() {
      return { open: model.authView !== null };
    },
    open: () => setAuthentication(model.authView ?? "login"),
    close: () => setAuthentication(null),
    toggle: () => setAuthentication(model.authView === null ? "login" : null),
  };

  const navigationDialog: OpenController = {
    get state() {
      return { open: model.drawerOpen };
    },
    open: () => setDrawerOpen(true),
    close: () => setDrawerOpen(false),
    toggle: () => setDrawerOpen(!model.drawerOpen),
  };

  return {
    get state() {
      return { model, homeHref, accountHref, logoutAction, privacyHref, apps, platformDowntime };
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
      const rail = model.rail === "expanded" ? "collapsed" : "expanded";
      model = { ...model, rail };
      onRailChange?.(rail);
    },
    logout() {
      if (model.session.status !== "authenticated") return false;
      if (!allowNativeLogout) model = { ...model, session: { status: "anonymous" } };
      return allowNativeLogout;
    },
    synchronizeRoute(routeState) {
      model = {
        ...model,
        activeNavigation: routeState.activeNavigation,
        session: routeState.session,
        drawerOpen: routeState.drawerOpen ?? model.drawerOpen,
        authView: routeState.authView,
        authorizationRequest: routeState.authorizationRequest,
      };
      if (routeState.authentication) {
        authentication.synchronize(routeState.authentication.model, routeState.authentication.action);
      }
    },
    synchronizeRail(rail) {
      if (model.rail !== rail) model = { ...model, rail };
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
}

/** Pure authentication-form state and transitions. */
export interface AuthenticationPanelController {
  readonly state: AuthenticationPanelControllerState;
  /** Shows or hides the password; every synchronization masks it again. */
  readonly passwordVisibility: PasswordInputController;
  /** Reconciles a completed route load or action with the rendered form. */
  synchronize(model: AuthenticationPanelModel, action: string): void;
  /** Validates submitted values, exposes field issues in state, and allows valid native submission. */
  submit(form: FormData): boolean;
}

/** Configuration for the default authentication-form controller. */
export interface AuthenticationPanelControllerOptions extends AuthenticationPanelControllerState {
  /** Allows the browser to submit the form after the controller accepts the transition. */
  allowNativeSubmission?: boolean;
}

/** Creates a reactive controller for a shell authentication form. */
export function createAuthenticationPanelController({
  model: initialModel,
  action: initialAction,
  allowNativeSubmission = true,
}: AuthenticationPanelControllerOptions): AuthenticationPanelController {
  let model = $state(initialModel);
  let action = $state(initialAction);
  const passwordVisibility = createPressedController();

  return {
    get state() {
      return { model, action };
    },
    passwordVisibility,
    synchronize(nextModel, nextAction) {
      passwordVisibility.setPressed(false);
      model = nextModel;
      action = nextAction;
    },
    submit(form) {
      if (lockedStatuses.has(model.state.status)) return false;

      const result = validators[model.journey](form);
      if (!result.success) {
        model = { ...model, state: { status: "validation-error", issues: result.issues } } as AuthenticationPanelModel;
        return false;
      }
      model = { ...model, state: { status: "submitting" } } as AuthenticationPanelModel;
      return allowNativeSubmission;
    },
  };
}
