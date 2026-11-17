<script lang="ts">
  import { setAuthenticationTitle } from "#lib/ui/PageTitle.svelte";
  import { PUBLIC_PLATFORM_DOMAIN } from "$app/env/public";
  import { afterNavigate, goto, invalidate } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import { readAuthenticationActionModel } from "./action-data";
  import {
    type AuthenticationJourney,
    type AuthenticationPanelControllerState,
    createAuthenticationPanelController,
    createShellController,
    readyAuthenticationModel,
  } from "./controller.svelte";
  import { shellSessionData } from "./dependencies";
  import { withNavigationOpen } from "./navigation-state";
  import { authenticationPageTitle } from "./page-title";
  import Screen from "./screen.svelte";
  import { normalizeAuthUrl, readAuthView, withAuthView } from "./url-state";

  import { saveNavigationRail } from "@a-novel-kit/nodelib-browser/preferences";
  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { getPlatformDowntime, hasTelemetryPreference, retryWhile } from "@a-novel-kit/nodelib-svelte";
  import { AuthorizationProvider } from "@a-novel-kit/uikit";
  import { createAuthorizationController } from "@a-novel-kit/uikit/authorization";

  let { children, data } = $props();
  const { t } = getI18nContext();
  const authorization = createAuthorizationController({
    getStatus: () => page.data.authorization ?? data.authorization,
  });

  const platformDowntime = getPlatformDowntime();
  // The address bar: the URL of the latest shallow navigation, which Back and Forward restore, until a full one.
  const url = $derived(new URL((page.shallow?.url ?? page.url).href));
  const authentication = createAuthenticationPanelController({
    // The dialog's journey, or a blank login form while the dialog is closed.
    getState: () => ({
      ...authenticationState(readAuthView(url.searchParams) ?? "login"),
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
    onDrawerChange: (open) => showShallow(withNavigationOpen(url, open)),
    // Every Agora app under the shared domain opens with the rail the visitor left.
    onRailChange: (rail) => saveNavigationRail(rail, { domain: PUBLIC_PLATFORM_DOMAIN }),
    getUrl: () => url,
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

  // A link may name an invalid or duplicate authentication view, which the address bar drops.
  afterNavigate(async ({ complete, shallow }) => {
    if (shallow) return;

    // History updates require the router to finish initial hydration.
    await complete;
    const normalized = normalizeAuthUrl(url);
    if (normalized.href !== url.href) showShallow(normalized);
  });

  /** Shows a URL change without loading the page. */
  function showShallow(next: URL, replace = true) {
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- Shallow routing edits the current, resolved URL.
    goto(next, { shallow: true, replace, state: page.state });
  }

  /** The authentication form of a view: the latest action result for it, or a blank form. */
  function authenticationState(view: AuthenticationJourney): AuthenticationPanelControllerState {
    return {
      model: readAuthenticationActionModel(page.form, view) ?? readyAuthenticationModel(view),
      action: authenticationAction(view),
    };
  }

  function authenticationAction(view: AuthenticationJourney): string {
    const target = new URL(resolve(""), url);
    target.searchParams.set("auth", view);

    const returnTo = url.searchParams.get("returnTo");
    if (returnTo) target.searchParams.set("returnTo", returnTo);

    return target.pathname + target.search;
  }

  /**
   * Shows an authentication view in the URL, with the menu closed: a journey opened from the menu closes it, and the
   * router may not have shown that yet.
   */
  function changeAuthView(view: AuthenticationJourney | null) {
    const previousView = readAuthView(url.searchParams);
    // Opening the dialog adds a history entry. Any other change replaces the current one.
    showShallow(withAuthView(withNavigationOpen(url, false), view), previousView !== null || view === null);
  }
</script>

<AuthorizationProvider controller={authorization}>
  <Screen {controller}>
    {@render children()}
  </Screen>
</AuthorizationProvider>
