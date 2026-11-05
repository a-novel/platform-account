<script module lang="ts">
  import type { AuthDialogView } from "#lib/application/shell/types.js";

  import type { ShellController } from "./controller.svelte";

  import type { Snippet } from "svelte";

  /** Props for the pure account shell. */
  export interface ShellProps {
    controller: ShellController;
    children?: Snippet;
  }
</script>

<script lang="ts">
  import AuthenticationPanel from "./authentication-panel.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import agoraBanner from "@a-novel-kit/ui-images/files/banner/80h/agora-banner.png";
  import agoraIcon48 from "@a-novel-kit/ui-images/files/icon/48x48/agora-icon.png";
  import studioIcon48 from "@a-novel-kit/ui-images/files/icon/48x48/studio-icon.png";
  import agoraIcon96 from "@a-novel-kit/ui-images/files/icon/96x96/agora-icon.png";
  import {
    Alert,
    Avatar,
    Button,
    Dialog,
    DowntimeBanner,
    DowntimeState,
    IconButton,
    InlineMessage,
    NavList,
    SkipLink,
    VisuallyHidden,
  } from "@a-novel-kit/uikit";

  import {
    House,
    LogIn,
    LogOut,
    Menu,
    PanelLeftClose,
    PanelLeftOpen,
    ShieldCheck,
    UserRoundPlus,
    X,
  } from "@lucide/svelte";

  let { controller, children }: ShellProps = $props();

  const platformDowntime = $derived(controller.state.platformDowntime);
  const stoppedUntil = $derived(platformDowntime?.started ? platformDowntime.downtime?.end : undefined);

  const model = $derived(controller.state.model);
  const privacyHref = $derived(controller.state.privacyHref);
  const authenticationState = $derived(controller.authentication.state.model.state.status);
  const authActionsVisible = $derived(authenticationState !== "pending-email" && authenticationState !== "recorded");

  const componentId = $props.id();
  const desktopNavigationId = `${componentId}-desktop-navigation`;
  const drawerId = `${componentId}-navigation-drawer`;
  const authenticationId = `${componentId}-authentication`;
  const compactRail = $derived(model.rail === "collapsed");
  const { t } = getI18nContext();
  const authenticatedSession = $derived(model.session.status === "authenticated" ? model.session : null);
  /** The account widget's notice while the session is loading, unavailable or stopped for maintenance. */
  const sessionNotice = $derived.by(() => {
    if (model.session.status === "loading") return { tone: "loading", message: t("shell.sessionLoading") } as const;
    if (model.session.status === "error") return { tone: "error", message: t("shell.sessionUnavailable") } as const;
    if (model.session.status === "downtime") return { tone: "warning", message: t("shell.sessionDowntime") } as const;
    return null;
  });
  const authDialogTitle = $derived.by(() => {
    if (authenticationState === "pending-email") return t("authUi.authentication.pendingTitle");
    if (authenticationState === "recorded") return t("authUi.authentication.journeys.register.recordedTitle");
    if (model.authView === "register") return t("shell.auth.register.title");
    if (model.authView === "reset") return t("shell.auth.reset.title");
    return t("shell.auth.login.title");
  });
  const authDialogDescription = $derived.by(() => {
    if (!authActionsVisible) return undefined;
    if (model.authView === "register") return t("shell.auth.register.description");
    if (model.authView === "reset") return t("shell.auth.reset.description");
    if (model.authorizationRequest) return t("shell.auth.login.authorizationDescription");
    return undefined;
  });

  function closeDrawerAfterNavigation(event: MouseEvent) {
    if (event.target instanceof Element && event.target.closest("a")) controller.navigationDialog.close();
  }

  function submitLogout(event: SubmitEvent) {
    if (!controller.logout()) event.preventDefault();
  }

  /** Tells whether a click asks for another tab or window, which the browser opens from the link itself. */
  function opensElsewhere(event: MouseEvent): boolean {
    return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
  }

  /** Runs a shell transition in place of a plain link click. The link's own URL serves every other click. */
  function navigate(event: MouseEvent, transition: () => void) {
    if (event.defaultPrevented || opensElsewhere(event)) return;
    event.preventDefault();
    transition();
  }
</script>

{#snippet homeIcon()}<House size="var(--icon-size-sm)" />{/snippet}

{#snippet studioIcon()}
  <img class="app-icon" src={studioIcon48} width="24" height="24" alt="" />
{/snippet}

{#snippet brand(compact: boolean)}
  <span class="brand" class:compact>
    {#if compact}
      <img
        class="brand-icon"
        src={agoraIcon48}
        srcset={`${agoraIcon48} 1x, ${agoraIcon96} 2x`}
        width="24"
        height="24"
        alt={t("shell.brand")}
      />
    {:else}
      <img class="brand-banner" src={agoraBanner} width="96" height="24" alt={t("shell.brand")} />
    {/if}
  </span>
{/snippet}

{#snippet navigationTitle()}
  {@render brand(false)}
{/snippet}

{#snippet primaryNavigation(compact: boolean, onNavigate?: (event: MouseEvent) => void)}
  <nav aria-label={t("shell.navigation")}>
    <NavList
      {compact}
      onclick={onNavigate}
      items={[
        {
          href: controller.state.homeHref,
          label: t("shell.home"),
          current: model.activeNavigation === "home",
          icon: homeIcon,
        },
      ]}
    />
  </nav>
{/snippet}

{#snippet appNavigation(compact: boolean, onNavigate?: (event: MouseEvent) => void)}
  {#if controller.state.apps}
    <nav aria-label={t("shell.apps.label")}>
      <NavList
        {compact}
        onclick={onNavigate}
        items={[{ href: controller.state.apps.studio, label: t("shell.apps.studio"), icon: studioIcon }]}
      />
    </nav>
  {/if}
{/snippet}

{#snippet accountWidget(compact: boolean)}
  <div class="account-widget" data-session={model.session.status}>
    {#if sessionNotice}
      {#if compact}
        <div class="compact-status" title={sessionNotice.message}>
          <InlineMessage tone={sessionNotice.tone} aria-label={sessionNotice.message} />
        </div>
      {:else}
        <!-- A title crowds the narrow rail, so the alert has none. -->
        <Alert tone={sessionNotice.tone}>{sessionNotice.message}</Alert>
      {/if}
    {:else if authenticatedSession}
      {@const name = authenticatedSession.displayName}
      <!-- This platform serves the account page, so it opens in place. -->
      <Button
        class="shell-account-button {compact ? 'compact-control' : ''}"
        variant="ghost"
        tone="neutral"
        size="sm"
        square={compact}
        title={name}
        href={controller.state.accountHref}
      >
        <span class="account-action-icon" aria-hidden="true">
          <Avatar label={name} initials={authenticatedSession.initials} src={authenticatedSession.picture} size="sm" />
        </span>
        {#if compact}
          <VisuallyHidden>{name}</VisuallyHidden>
        {:else}
          <span class="account-label">{name}</span>
        {/if}
      </Button>
      <form class="logout-form" method="POST" action={controller.state.logoutAction} onsubmit={submitLogout}>
        <Button
          class="shell-account-button {compact ? 'compact-control' : ''}"
          type="submit"
          variant="ghost"
          tone="neutral"
          size="sm"
          square={compact}
          aria-label={compact ? t("shell.logout") : undefined}
          title={compact ? t("shell.logout") : undefined}
        >
          <span class="account-action-icon" aria-hidden="true">
            <LogOut size="var(--icon-size-sm)" />
          </span>
          {#if !compact}<span>{t("shell.logout")}</span>{/if}
        </Button>
      </form>
    {:else}
      <Button
        class="shell-account-button {compact ? 'compact-control' : ''}"
        variant="ghost"
        tone="neutral"
        size="sm"
        square={compact}
        aria-label={compact ? t("shell.signIn") : undefined}
        title={compact ? t("shell.signIn") : undefined}
        href={controller.authenticationHref("login")}
        onclick={(event: MouseEvent) => navigate(event, () => controller.openAuthentication("login"))}
      >
        <span class="account-action-icon" aria-hidden="true">
          <LogIn size="var(--icon-size-sm)" />
        </span>
        {#if !compact}<span>{t("shell.signIn")}</span>{/if}
      </Button>
      <Button
        class="shell-account-button {compact ? 'compact-control' : ''}"
        variant="ghost"
        tone="neutral"
        size="sm"
        square={compact}
        aria-label={compact ? t("shell.register") : undefined}
        title={compact ? t("shell.register") : undefined}
        href={controller.authenticationHref("register")}
        onclick={(event: MouseEvent) => navigate(event, () => controller.openAuthentication("register"))}
      >
        <span class="account-action-icon" aria-hidden="true">
          <UserRoundPlus size="var(--icon-size-sm)" />
        </span>
        {#if !compact}<span>{t("shell.register")}</span>{/if}
      </Button>
    {/if}
    {#if privacyHref && !authenticatedSession}
      <!-- A logged-in visitor changes their answer from their account. -->
      <Button
        class="shell-account-button {compact ? 'compact-control' : ''}"
        variant="ghost"
        tone="neutral"
        size="sm"
        square={compact}
        aria-label={compact ? t("shell.privacy") : undefined}
        aria-current={model.activeNavigation === "privacy" ? "page" : undefined}
        title={compact ? t("shell.privacy") : undefined}
        href={privacyHref}
      >
        <span class="account-action-icon" aria-hidden="true">
          <ShieldCheck size="var(--icon-size-sm)" />
        </span>
        {#if !compact}<span>{t("shell.privacy")}</span>{/if}
      </Button>
    {/if}
  </div>
{/snippet}

<!-- A quiet text button: the journey reads as text, without a box until it is hovered. -->
{#snippet authLink(view: AuthDialogView, label: string)}
  <Button
    variant="text"
    tone="brand"
    size="sm"
    href={controller.authenticationHref(view)}
    onclick={(event: MouseEvent) => navigate(event, () => controller.openAuthentication(view))}
  >
    {label}
  </Button>
{/snippet}

{#snippet forgotPassword()}
  {@render authLink("reset", t("shell.auth.forgotPassword"))}
{/snippet}

{#snippet authSwitch()}
  <p class="auth-switch">
    {#if model.authView === "login"}
      {t("shell.auth.noAccount")}
      {@render authLink("register", t("shell.register"))}
    {:else if model.authView === "register"}
      {t("shell.auth.hasAccount")}
      {@render authLink("login", t("shell.signIn"))}
    {:else}
      {t("shell.auth.remembersPassword")}
      {@render authLink("login", t("shell.signIn"))}
    {/if}
  </p>
{/snippet}

<div class="shell-viewport">
  <SkipLink href="#main-content">{t("shell.skipToContent")}</SkipLink>

  <div class="shell" data-rail={model.rail}>
    <aside class="rail" class:collapsed={compactRail} aria-label={t("shell.navigation")}>
      <div class="rail-header">
        {@render brand(compactRail)}
        <IconButton
          label={compactRail ? t("shell.expandNavigation") : t("shell.collapseNavigation")}
          variant="ghost"
          tone="neutral"
          size="sm"
          aria-controls={desktopNavigationId}
          aria-expanded={!compactRail}
          onclick={() => controller.toggleRail()}
        >
          {#if compactRail}
            <PanelLeftOpen size="var(--icon-size-sm)" aria-hidden="true" />
          {:else}
            <PanelLeftClose size="var(--icon-size-sm)" aria-hidden="true" />
          {/if}
        </IconButton>
      </div>

      <div id={desktopNavigationId} class="rail-navigation">
        {@render primaryNavigation(compactRail)}
        {@render appNavigation(compactRail)}
      </div>

      <div class="rail-account">
        {@render accountWidget(compactRail)}
      </div>
    </aside>

    <div class="workspace">
      <header class="mobile-header">
        {@render brand(false)}
        <IconButton
          label={t("shell.openNavigation")}
          variant="ghost"
          tone="neutral"
          size="sm"
          aria-controls={drawerId}
          aria-expanded={controller.navigationDialog.state.open}
          href={controller.navigationHref(true)}
          onclick={(event: MouseEvent) => navigate(event, () => controller.navigationDialog.open())}
        >
          <Menu size="var(--icon-size-sm)" aria-hidden="true" />
        </IconButton>
      </header>

      {#if platformDowntime?.downtime}
        <div class="downtime">
          <DowntimeBanner
            start={platformDowntime.downtime.start}
            end={platformDowntime.downtime.end}
            started={platformDowntime.started}
            timeZone={platformDowntime.timeZone}
          />
        </div>
      {/if}

      <main id="main-content" class="main-content" tabindex="-1">
        {@render children?.()}
      </main>
    </div>
  </div>

  <!-- The menu comes first, so a journey opened from it closes the menu before the dialog opens, and
       closing the dialog returns focus to the menu control. -->
  <Dialog id={drawerId} controller={controller.navigationDialog} title={navigationTitle} presentation="fullscreen">
    {#snippet headerActions()}
      <IconButton
        label={t("shell.closeNavigation")}
        variant="ghost"
        tone="neutral"
        size="sm"
        href={controller.navigationHref(false)}
        onclick={(event: MouseEvent) => navigate(event, () => controller.navigationDialog.close())}
      >
        <X size="var(--icon-size-sm)" aria-hidden="true" />
      </IconButton>
    {/snippet}
    <div class="drawer-content">
      <div class="drawer-navigation">
        {@render primaryNavigation(false, closeDrawerAfterNavigation)}
        {@render appNavigation(false, closeDrawerAfterNavigation)}
      </div>
      <div class="drawer-account">
        {@render accountWidget(false)}
      </div>
    </div>
  </Dialog>

  <Dialog
    id={authenticationId}
    controller={controller.authenticationDialog}
    title={authDialogTitle}
    description={authDialogDescription}
    size="sm"
  >
    {#snippet headerActions()}
      <IconButton
        label={t("shell.closeAuthentication")}
        variant="ghost"
        tone="neutral"
        size="sm"
        href={controller.authenticationHref(null)}
        onclick={(event: MouseEvent) => navigate(event, () => controller.authenticationDialog.close())}
      >
        <X size="var(--icon-size-sm)" aria-hidden="true" />
      </IconButton>
    {/snippet}
    {#if stoppedUntil && model.authView}
      <DowntimeState end={stoppedUntil} timeZone={platformDowntime?.timeZone} headingLevel={3} />
    {:else if model.authView}
      <AuthenticationPanel controller={controller.authentication} {forgotPassword} />
      {#if authActionsVisible}{@render authSwitch()}{/if}
    {/if}
  </Dialog>
</div>

<style>
  .shell-viewport {
    container: app-shell / inline-size;
    min-block-size: 100dvb;
    color: var(--color-text-primary);
  }

  .shell {
    --shell-rail-width: clamp(var(--layout-sidebar-min), var(--layout-sidebar), 18rem);

    display: grid;
    grid-template-columns: var(--shell-rail-width) minmax(0, 1fr);
    min-block-size: 100dvb;
  }

  .shell[data-rail="collapsed"] {
    --shell-rail-width: calc(var(--control-height-sm) + var(--space-4));
  }

  .rail {
    display: grid;
    position: sticky;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: var(--space-4);
    z-index: var(--layer-sticky);
    box-sizing: border-box;
    inset-block-start: 0;
    padding: var(--space-2);
    inline-size: var(--shell-rail-width);
    block-size: 100dvb;
    overflow: hidden;
  }

  /* The app's lamp lights the navigation where it crosses it, in line with the canvas. */
  .rail,
  .mobile-header {
    background: var(--fill-navigation);
  }

  .rail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-1);
    min-inline-size: 0;
  }

  .collapsed .rail-header {
    flex-direction: column;
    justify-content: center;
  }

  .brand {
    display: flex;
    align-items: center;
    padding-inline: var(--space-2);
    min-inline-size: 0;
  }

  .brand.compact {
    padding: var(--space-1);
  }

  .brand-banner,
  .brand-icon {
    display: block;
    flex: none;
    object-fit: contain;
  }

  .brand-banner {
    inline-size: calc(var(--control-height-sm) * 3);
    max-inline-size: 100%;
    block-size: var(--control-height-sm);
  }

  .brand-icon {
    inline-size: var(--icon-size-lg);
    block-size: var(--icon-size-lg);
  }

  /* The app list follows the platform's own destinations as a group of its own. */
  .rail-navigation,
  .drawer-navigation {
    display: grid;
    align-content: start;
    gap: var(--space-4);
    min-block-size: 0;
    overflow-y: auto;
    overscroll-behavior-block: contain;
  }

  .app-icon {
    display: block;
    inline-size: var(--icon-size-md);
    block-size: var(--icon-size-md);
  }

  .rail-account,
  .drawer-account {
    min-inline-size: 0;
  }

  .account-widget {
    display: grid;
    gap: var(--space-2);
    min-inline-size: 0;
  }

  .logout-form {
    margin: 0;
    min-inline-size: 0;
  }

  .account-action-icon {
    display: inline-flex;
    flex: none;
    justify-content: center;
    align-items: center;
    inline-size: var(--control-height-sm);
  }

  .account-label {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compact-status {
    display: grid;
    place-items: center;
    inline-size: var(--control-height-sm);
    block-size: var(--control-height-sm);
  }

  :global(.shell-account-button) {
    max-inline-size: 100%;
  }

  :global(:is(a, button).shell-account-button:not(.compact-control)) {
    justify-content: flex-start;
    border: 0;
    padding: var(--space-2) var(--space-3);
    inline-size: 100%;
    overflow: hidden;
    text-align: start;
  }

  /* Switching journeys closes the form: a hairline sets it apart from the submission. */
  .auth-switch {
    margin: var(--space-6) 0 0;
    border-block-start: var(--border-width-thin) solid var(--color-border-default);
    padding-block-start: var(--space-4);
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    text-align: center;
  }

  /* A column, so the sticky header and banner can stay in view across the whole content. */
  .workspace {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    min-block-size: 100dvb;
  }

  /* The maintenance banner stays above the content while it scrolls. */
  .downtime {
    position: sticky;
    z-index: var(--layer-sticky);
    inset-block-start: 0;
  }

  .mobile-header {
    display: none;
  }

  /* A column, so a page can fill the height the workspace leaves it and center itself in it. */
  .main-content {
    display: flex;
    flex: 1;
    flex-direction: column;
    outline: none;
    min-inline-size: 0;
  }

  .main-content:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-ring-offset) * -1);
  }

  .drawer-content {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: var(--space-2);
    min-inline-size: 0;
    min-block-size: 0;
  }

  @container app-shell (max-width: 47.999rem) {
    .shell {
      grid-template-columns: minmax(0, 1fr);
    }

    .rail {
      display: none;
    }

    /* On narrow screens it waits at the bottom, away from where reading starts, and never covers the end. */
    .downtime {
      order: 1;
      inset-block-end: 0;
      inset-block-start: auto;
    }

    .mobile-header {
      display: flex;
      position: sticky;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-2);
      z-index: var(--layer-sticky);
      inset-block-start: 0;
      padding: var(--space-4);
    }
  }

  @media (forced-colors: active) {
    .rail,
    .mobile-header {
      border: var(--border-width-thin) solid CanvasText;
    }
  }
</style>
