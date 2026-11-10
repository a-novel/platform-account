<script lang="ts">
  import type { AuthDialogView } from "#lib/application/shell/types.js";
  import { retryWhile } from "#lib/client/retry.svelte.js";
  import { authenticationPageTitle } from "#lib/i18n/page-titles.js";
  import { setAuthenticationTitle } from "#lib/ui/PageTitle.svelte";
  import { getPlatformDowntime } from "#lib/ui/downtime.svelte.js";
  import { hasTelemetryPreference } from "#lib/ui/telemetry-preference.js";
  import { PUBLIC_PLATFORM_DOMAIN } from "$app/env/public";
  import { afterNavigate, goto, invalidate } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import { readAuthenticationActionModel } from "./action-data";
  import { normalizeAuthUrl, readAuthView, withAuthView } from "./auth-dialog-state";
  import {
    type AuthenticationPanelControllerState,
    createAuthenticationPanelController,
    createShellController,
    readyAuthenticationModel,
  } from "./controller.svelte";
  import { shellSessionData } from "./dependencies";
  import { withNavigationOpen } from "./navigation-state";
  import Screen from "./screen.svelte";

  import { onMount } from "svelte";

  import { saveNavigationRail } from "@a-novel-kit/nodelib-browser/preferences";
  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { AuthorizationProvider } from "@a-novel-kit/uikit";
  import { createAuthorizationController } from "@a-novel-kit/uikit/authorization";

  let { children, data } = $props();
  const { t } = getI18nContext();
  const authorization = createAuthorizationController({
    getStatus: () => page.data.authorization ?? data.authorization,
  });

  const platformDowntime = getPlatformDowntime();
  let currentHref = $state(page.url.href);
  const authentication = createAuthenticationPanelController({
    // The dialog's journey, or a blank login form while the dialog is closed.
    getState: () => ({
      ...authenticationState(readAuthView(new URL(currentHref).searchParams) ?? "login"),
      maintenance: platformDowntime.started,
    }),
  });
  const controller = createShellController({
    getData: () => data,
    homeHref: resolve(""),
    accountHref: resolve("account"),
    logoutAction: resolve("auth/logout"),
    // Only a platform that collects browser telemetry asks for consent, so only it offers to change the answer.
    privacyHref: hasTelemetryPreference() ? resolve("privacy") : null,
    platformDowntime,
    authentication,
    onAuthViewChange: changeAuthView,
    onDrawerChange: (open) => showShallow(withNavigationOpen(new URL(currentHref), open)),
    // Every Agora app under the shared domain opens with the rail the visitor left.
    onRailChange: (rail) => saveNavigationRail(rail, { domain: PUBLIC_PLATFORM_DOMAIN }),
    getUrl: () => new URL(currentHref),
    // The home route only renders a posted form's result over the locked account page.
    getAuthLocked: () => page.status === 401 || page.route.id === "/(app)/(home)",
  });

  retryWhile(
    () => data.session.status === "loading",
    () => invalidate(shellSessionData)
  );

  // A page locked for a missing login still titles the dialog that opens over it.
  setAuthenticationTitle(() =>
    (!page.error || page.status === 401) && controller.state.model.authView
      ? authenticationPageTitle(t, controller.authentication.state.model)
      : undefined
  );

  afterNavigate(async ({ complete, shallow }) => {
    if (shallow) return;

    // History updates require the router to finish initial hydration.
    await complete;
    synchronizeUrl();
  });

  onMount(() => {
    window.addEventListener("popstate", synchronizeUrl);

    return () => window.removeEventListener("popstate", synchronizeUrl);
  });

  /** Shows a URL change without loading the page, and makes it the shell's current URL. */
  function showShallow(next: URL, replace = true) {
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- Shallow routing edits the current, resolved URL.
    goto(next, { shallow: true, replace, state: page.state });
    currentHref = next.href;
  }

  function synchronizeUrl() {
    const normalized = normalizeAuthUrl(new URL(window.location.href));
    if (normalized.href !== window.location.href) showShallow(normalized);
    else currentHref = normalized.href;
  }

  /** The authentication form of a view: the latest action result for it, or a blank form. */
  function authenticationState(view: AuthDialogView): AuthenticationPanelControllerState {
    return {
      model: readAuthenticationActionModel(page.form, view) ?? readyAuthenticationModel(view),
      action: authenticationAction(view),
    };
  }

  function authenticationAction(view: AuthDialogView): string {
    const current = new URL(currentHref);
    const target = new URL(resolve(""), current);
    target.searchParams.set("auth", view);

    const returnTo = current.searchParams.get("returnTo");
    if (returnTo) target.searchParams.set("returnTo", returnTo);

    return target.pathname + target.search;
  }

  /**
   * Shows an authentication view in the URL. A journey opened from the menu also closes the menu, before the router
   * updates the address bar, so each change builds on the shell's current URL rather than the browser's.
   */
  function changeAuthView(view: AuthDialogView | null) {
    const previousView = readAuthView(new URL(currentHref).searchParams);
    // Opening the dialog adds a history entry. Any other change replaces the current one.
    showShallow(withAuthView(new URL(currentHref), view), previousView !== null || view === null);
  }
</script>

<AuthorizationProvider controller={authorization}>
  <Screen {controller}>
    {@render children()}
  </Screen>
</AuthorizationProvider>
