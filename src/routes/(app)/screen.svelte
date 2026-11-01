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
  import { getPlatformDowntime, hasPlatformDowntime } from "#lib/ui/downtime.svelte.js";
  import { hasTelemetryPreference } from "#lib/ui/telemetry-preference.js";

  import AuthenticationPanel from "./(authentication)/screen.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import agoraBanner from "@a-novel-kit/ui-images/files/banner/80h/agora-banner.png";
  import studioIcon48 from "@a-novel-kit/ui-images/files/icon/48x48/studio-icon.png";
  import {
    Avatar,
    Button,
    Dialog,
    DowntimeBanner,
    DowntimeState,
    IconButton,
    InlineMessage,
    NavList,
    Popover,
    SkipLink,
  } from "@a-novel-kit/uikit";

  import { LayoutGrid, LogIn, LogOut, ShieldCheck, X } from "@lucide/svelte";

  let { controller, children }: ShellProps = $props();

  // Stories and tests render the shell without the app's downtime tracking.
  const platformDowntime = hasPlatformDowntime() ? getPlatformDowntime() : undefined;
  const stoppedUntil = $derived(platformDowntime?.started ? platformDowntime.downtime?.end : undefined);

  const model = $derived(controller.state.model);
  const authenticationState = $derived(controller.authentication.state.model.state.status);
  const authActionsVisible = $derived(authenticationState !== "pending-email" && authenticationState !== "recorded");

  const componentId = $props.id();
  const authenticationId = `${componentId}-authentication`;
  const { t } = getI18nContext();
  // Only a platform that collects browser telemetry asks for consent, so only it offers to change the answer.
  const collectsTelemetry = hasTelemetryPreference();
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
    return undefined;
  });

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

{#snippet studioIcon()}
  <img class="app-icon" src={studioIcon48} width="24" height="24" alt="" />
{/snippet}

{#snippet accountWidget()}
  <div class="account-widget" data-session={model.session.status}>
    {#if sessionNotice}
      <InlineMessage tone={sessionNotice.tone}>{sessionNotice.message}</InlineMessage>
    {:else if authenticatedSession}
      <Button class="account-link" variant="ghost" tone="neutral" size="sm" href={controller.state.accountHref}>
        <!-- The name beside it labels the link, so the avatar stays silent. -->
        <span class="account-avatar" aria-hidden="true">
          <Avatar label={authenticatedSession.displayName} initials={authenticatedSession.initials} size="sm" />
        </span>
        <span class="account-name">{authenticatedSession.displayName}</span>
      </Button>
      <form class="logout-form" method="POST" action={controller.state.logoutAction} onsubmit={submitLogout}>
        <IconButton label={t("shell.logout")} type="submit" variant="ghost" tone="neutral" size="sm">
          <LogOut size="var(--icon-size-sm)" aria-hidden="true" />
        </IconButton>
      </form>
    {:else}
      <Button
        variant="ghost"
        tone="neutral"
        size="sm"
        href={controller.authenticationHref("login")}
        onclick={(event: MouseEvent) => navigate(event, () => controller.openAuthentication("login"))}
      >
        <LogIn size="var(--icon-size-sm)" aria-hidden="true" />
        <span>{t("shell.signIn")}</span>
      </Button>
    {/if}
  </div>
{/snippet}

{#snippet authLink(view: AuthDialogView, label: string)}
  <Button
    variant="ghost"
    tone="neutral"
    size="sm"
    href={controller.authenticationHref(view)}
    onclick={(event: MouseEvent) => navigate(event, () => controller.openAuthentication(view))}
  >
    {label}
  </Button>
{/snippet}

{#snippet authActions()}
  {#if model.authView === "login"}
    {@render authLink("reset", t("shell.auth.forgotPassword"))}
    {@render authLink("register", t("shell.auth.createAccount"))}
  {:else if model.authView}
    {@render authLink("login", t("shell.signIn"))}
  {/if}
{/snippet}

<div class="shell">
  <SkipLink href="#main-content">{t("shell.skipToContent")}</SkipLink>

  <header class="top-bar">
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- The layout resolves the shell's links. -->
    <a class="brand" href={controller.state.homeHref}>
      <img class="brand-banner" src={agoraBanner} width="96" height="24" alt={t("shell.brand")} />
    </a>

    <div class="top-bar-actions">
      {#if collectsTelemetry}
        <IconButton
          label={t("shell.privacy")}
          variant="ghost"
          tone="neutral"
          size="sm"
          href={controller.state.privacyHref}
        >
          <ShieldCheck size="var(--icon-size-sm)" aria-hidden="true" />
        </IconButton>
      {/if}
      {#if controller.state.apps}
        <Popover controller={controller.appList} position="bottom">
          {#snippet trigger(attributes)}
            <IconButton {...attributes} label={t("shell.apps.label")} variant="ghost" tone="neutral" size="sm">
              <LayoutGrid size="var(--icon-size-sm)" aria-hidden="true" />
            </IconButton>
          {/snippet}
          <nav class="app-list" aria-label={t("shell.apps.label")}>
            <NavList
              items={[{ href: controller.state.apps.studio, label: t("shell.apps.studio"), icon: studioIcon }]}
            />
          </nav>
        </Popover>
      {/if}

      {@render accountWidget()}
    </div>
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

  <Dialog
    id={authenticationId}
    controller={controller.authenticationDialog}
    title={authDialogTitle}
    description={authDialogDescription}
    actions={authActionsVisible && !stoppedUntil ? authActions : undefined}
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
      <AuthenticationPanel controller={controller.authentication} />
    {/if}
  </Dialog>
</div>

<style>
  /* A column, so the sticky header and banner can stay in view across the whole content. */
  .shell {
    display: flex;
    flex-direction: column;
    container: account-shell / inline-size;
    background: var(--color-surface-canvas);
    min-block-size: 100dvb;
    color: var(--color-text-primary);
  }

  .top-bar {
    display: flex;
    position: sticky;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
    z-index: var(--layer-sticky);
    inset-block-start: 0;
    background: var(--color-surface-island-strong);
    padding: var(--space-2) var(--space-4);
  }

  .brand {
    display: flex;
    flex: none;
    align-items: center;
    border-radius: var(--radius-sm);
    padding-inline: var(--space-2);
  }

  .brand:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  .brand-banner {
    display: block;
    inline-size: calc(var(--control-height-sm) * 3);
    block-size: var(--control-height-sm);
    object-fit: contain;
  }

  .top-bar-actions,
  .account-widget {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-inline-size: 0;
  }

  .app-list {
    min-inline-size: 12rem;
  }

  .app-icon {
    display: block;
    inline-size: var(--icon-size-md);
    block-size: var(--icon-size-md);
  }

  .account-avatar {
    display: contents;
  }

  .logout-form {
    margin: 0;
  }

  .account-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The avatar fills the link's height, so the link keeps the header's control height. Scoped under
     the header so it outranks the button's own size padding. */
  .top-bar :global(.account-link) {
    padding-block: 0;
    min-inline-size: 0;
    max-inline-size: 16rem;
  }

  /* The maintenance banner stays above the content while it scrolls. */
  .downtime {
    position: sticky;
    z-index: var(--layer-sticky);
    inset-block-start: 0;
  }

  /* A column, so a page can fill the height left under the header and center itself in it. */
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

  @container account-shell (max-width: 47.999rem) {
    .top-bar {
      padding: var(--space-4);
    }

    /* The avatar names the account on narrow screens; the name stays for assistive technology. */
    .account-name {
      position: absolute;
      clip-path: inset(50%);
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      white-space: nowrap;
    }

    /* On narrow screens it waits at the bottom, away from where reading starts, and never covers the end. */
    .downtime {
      order: 1;
      inset-block-end: 0;
      inset-block-start: auto;
    }
  }

  @media (forced-colors: active) {
    .top-bar {
      border-block-end: var(--border-width-thin) solid CanvasText;
    }
  }
</style>
