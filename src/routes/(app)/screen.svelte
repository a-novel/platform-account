<script module lang="ts">
  import type { AuthenticationJourney, ShellController } from "./controller.svelte";

  import type { Snippet } from "svelte";

  /** Props for the pure account shell. */
  interface ShellProps {
    controller: ShellController;
    children?: Snippet;
  }
</script>

<script lang="ts">
  import AuthenticationPanel from "./authentication-panel.svelte";
  import CloseLink from "./close-link.svelte";
  import { followInPlace } from "./link-transition";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import agoraBanner from "@a-novel-kit/ui-images/files/banner/80h/agora-banner.png";
  import agoraIcon48 from "@a-novel-kit/ui-images/files/icon/48x48/agora-icon.png";
  import studioIcon48 from "@a-novel-kit/ui-images/files/icon/48x48/studio-icon.png";
  import agoraIcon96 from "@a-novel-kit/ui-images/files/icon/96x96/agora-icon.png";
  import {
    Avatar,
    Button,
    type ButtonLinkProps,
    type ButtonProps,
    Dialog,
    DowntimeBanner,
    IconButton,
    NavList,
    Separator,
    ShellLayout,
    Skeleton,
    SkipLink,
    VisuallyHidden,
  } from "@a-novel-kit/uikit";

  import { LogIn, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck, UserRoundPlus } from "@lucide/svelte";

  let { controller, children }: ShellProps = $props();

  const platformDowntime = $derived(controller.state.platformDowntime);

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
  const authDialogTitle = $derived.by(() => {
    if (authenticationState === "pending-email") return t("shell.auth.pendingTitle");
    if (authenticationState === "recorded") return t("shell.auth.register.recordedTitle");
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
</script>

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

<!-- A control of the rail's account group: its icon and label, or the icon alone, named by its title, on a collapsed
     rail. -->
{#snippet railButton(compact: boolean, label: string, Icon: typeof LogIn, props: ButtonProps | ButtonLinkProps)}
  <Button
    {...props}
    class="shell-account-button {compact ? 'compact-control' : ''}"
    variant="ghost"
    tone="neutral"
    size="sm"
    square={compact}
    aria-label={compact ? label : undefined}
    title={compact ? label : undefined}
  >
    <span class="account-action-icon" aria-hidden="true">
      <Icon size="var(--icon-size-sm)" />
    </span>
    {#if !compact}<span>{label}</span>{/if}
  </Button>
{/snippet}

<!-- Links of one group touch. The account and the logout stand apart, so a click meant for one never lands
     on the other. -->
{#snippet accountWidget(compact: boolean)}
  <div class="account-widget" data-session={model.session.status}>
    {#if model.session.status !== "anonymous"}
      {@const label = authenticatedSession?.displayName ?? t("shell.accountFallback")}
      <!-- This platform serves the account page, so it opens in place, even while the account's details load. -->
      <Button
        class="shell-account-button {compact ? 'compact-control' : ''}"
        variant="ghost"
        tone="neutral"
        size="sm"
        square={compact}
        title={label}
        href={controller.state.accountHref}
        aria-current={model.activeNavigation === "account" ? "page" : undefined}
      >
        <span class="account-action-icon account-picture" aria-hidden="true">
          {#if authenticatedSession}
            <Avatar
              {label}
              initials={authenticatedSession.initials}
              src={authenticatedSession.picture}
              size="sm"
              shape="square"
            />
          {:else}
            <Skeleton class="account-picture-skeleton" shape="rectangle" />
          {/if}
        </span>
        {#if authenticatedSession && !compact}
          <span class="account-label">{label}</span>
        {:else}
          <VisuallyHidden>{label}</VisuallyHidden>
          {#if !compact}<Skeleton class="account-label-skeleton" />{/if}
        {/if}
      </Button>
      <Separator decorative />
      <form class="logout-form" method="POST" action={controller.state.logoutAction}>
        {@render railButton(compact, t("shell.logout"), LogOut, { type: "submit" })}
      </form>
    {:else}
      <div class="link-group">
        {@render railButton(compact, t("shell.signIn"), LogIn, {
          href: controller.authenticationHref("login"),
          onclick: (event: MouseEvent) => followInPlace(event, () => controller.openAuthentication("login")),
        })}
        {@render railButton(compact, t("shell.register"), UserRoundPlus, {
          href: controller.authenticationHref("register"),
          onclick: (event: MouseEvent) => followInPlace(event, () => controller.openAuthentication("register")),
        })}
        <!-- A logged-in visitor changes their answer from their account. -->
        {#if privacyHref}
          {@render railButton(compact, t("shell.privacy"), ShieldCheck, {
            href: privacyHref,
            "aria-current": model.activeNavigation === "privacy" ? "page" : undefined,
          })}
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

<!-- A quiet text button: the journey reads as text, without a box until it is hovered. -->
{#snippet authLink(view: AuthenticationJourney, label: string)}
  <Button
    variant="text"
    tone="brand"
    size="sm"
    href={controller.authenticationHref(view)}
    onclick={(event: MouseEvent) => followInPlace(event, () => controller.openAuthentication(view))}
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

{#snippet closeAuthentication()}
  <CloseLink
    label={t("shell.closeAuthentication")}
    href={controller.authenticationHref(null)}
    onclose={controller.authenticationDialog.close}
  />
{/snippet}

{#snippet downtimeBanner()}
  {#if platformDowntime?.downtime}
    <DowntimeBanner
      start={platformDowntime.downtime.start}
      end={platformDowntime.downtime.end}
      started={platformDowntime.started}
      timeZone={platformDowntime.timeZone}
    />
  {/if}
{/snippet}

<div class="shell-viewport">
  <SkipLink href="#main-content">{t("shell.skipToContent")}</SkipLink>

  <ShellLayout collapsed={compactRail} banner={platformDowntime?.downtime ? downtimeBanner : undefined}>
    {#snippet rail()}
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

        <div class="rail-body">
          <div id={desktopNavigationId} class="rail-navigation">
            {@render appNavigation(compactRail)}
          </div>

          <div class="rail-account">
            {@render accountWidget(compactRail)}
          </div>
        </div>
      </aside>
    {/snippet}

    {#snippet header()}
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
          onclick={(event: MouseEvent) => followInPlace(event, () => controller.navigationDialog.open())}
        >
          <Menu size="var(--icon-size-sm)" aria-hidden="true" />
        </IconButton>
      </header>
    {/snippet}

    <main id="main-content" class="main-content" tabindex="-1">
      {@render children?.()}
    </main>
  </ShellLayout>

  <!-- The menu comes first, so a journey opened from it closes the menu before the dialog opens, and
       closing the dialog returns focus to the menu control. -->
  <Dialog id={drawerId} controller={controller.navigationDialog} title={navigationTitle} presentation="fullscreen">
    {#snippet headerActions()}
      <CloseLink
        label={t("shell.closeNavigation")}
        href={controller.navigationHref(false)}
        onclose={controller.navigationDialog.close}
      />
    {/snippet}
    <div class="drawer-content">
      <div class="drawer-navigation">
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
    headerActions={model.authLocked ? undefined : closeAuthentication}
  >
    {#if model.authView}
      <AuthenticationPanel controller={controller.authentication} {forgotPassword} />
      {#if authActionsVisible || model.authLocked}{@render authSwitch()}{/if}
      <!-- The dialog covers the rail for good on a page that needs a login, so it carries the rail's public link. -->
      {#if model.authLocked && privacyHref}
        <p class="auth-privacy">
          <Button variant="text" tone="neutral" size="sm" href={privacyHref}>{t("shell.privacy")}</Button>
        </p>
      {/if}
    {/if}
  </Dialog>
</div>

<style>
  .shell-viewport {
    color: var(--color-text-primary);
  }

  .rail {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--space-4);
    min-block-size: 0;
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

  /* The links above and the account below stay far apart, however long the links run: the links scroll. */
  .rail-body,
  .drawer-content {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: var(--space-8);
    min-inline-size: 0;
    min-block-size: 0;
  }

  /* The app list follows the platform's own destinations as a group of its own, past a separator. */
  .rail-navigation,
  .drawer-navigation {
    display: grid;
    align-content: start;
    gap: var(--space-2);
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

  .link-group {
    display: grid;
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

  /* The picture stays muted until the pointer or the keyboard reaches its button, or its page is showing. */
  .account-picture {
    filter: saturate(50%) brightness(75%);
    transition: filter var(--duration-fast) var(--easing-standard);
  }

  :global(.shell-account-button:is(:hover, :focus-visible, [aria-current="page"])) .account-picture {
    filter: none;
  }

  .account-label {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-action-icon :global(.account-picture-skeleton) {
    inline-size: var(--control-height-sm);
    block-size: var(--control-height-sm);
    min-block-size: 0;
  }

  :global(.shell-account-button) > :global(.account-label-skeleton) {
    flex: 1;
    min-inline-size: 0;
  }

  :global(.shell-account-button) {
    max-inline-size: 100%;
  }

  /* Only the width goes: the shorthand would also reset the border's color, which the rail's compact
     buttons would then fade from, as an outline, each time it collapses. */
  :global(:is(a, button).shell-account-button:not(.compact-control)) {
    justify-content: flex-start;
    border-width: 0;
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

  .auth-privacy {
    margin: var(--space-2) 0 0;
    text-align: center;
  }

  /* Puts the brand at one end of the header and the menu control at the other; the shell sizes the header and shows it on narrow screens. */
  .mobile-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }

  /* A column, so a page can center itself in the height the shell gives it. The skip link's target takes focus
     without a ring, so a click or a scrolling key never outlines the whole page; the next Tab reaches a control,
     which shows its own. */
  .main-content {
    display: flex;
    flex-direction: column;
    outline: none;
    min-inline-size: 0;
  }
</style>
