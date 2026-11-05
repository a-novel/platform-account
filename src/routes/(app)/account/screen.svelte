<script module lang="ts">
  import type { AccountLayoutController } from "./controller.svelte";

  import type { Snippet } from "svelte";

  /** Props for the account layout: the header, the tab bar and the tab showing. */
  export interface AccountLayoutScreenProps {
    controller: AccountLayoutController;
    children: Snippet;
  }
</script>

<script lang="ts">
  import { translateAuthenticationFeedback } from "#lib/i18n/auth-feedback.js";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Alert, Avatar, Badge, Button, NavList, VisuallyHidden } from "@a-novel-kit/uikit";
  import { Role } from "@a-novel/service-authentication-rest";

  import { Camera, LogOut } from "@lucide/svelte";

  let { controller, children }: AccountLayoutScreenProps = $props();

  const layout = $derived(controller.state);
  const summary = $derived(layout.summary);
  const componentId = $props.id();
  const { t } = getI18nContext();

  const tabs = $derived([
    {
      href: layout.tabs.information,
      label: t("authUi.account.tabs.information"),
      current: layout.currentTab === "information",
    },
    { href: layout.tabs.devices, label: t("authUi.account.tabs.devices"), current: layout.currentTab === "devices" },
    { href: layout.tabs.privacy, label: t("authUi.account.tabs.privacy"), current: layout.currentTab === "privacy" },
  ]);

  const profile = $derived(summary.status === "ready" ? summary.profile : undefined);
  // An account without a picture shows initials: two from a dotted or dashed handle.
  const initials = $derived.by(() => {
    const handle = (summary.status === "ready" && summary.email?.split("@")[0]) || "";
    const words = handle.split(/[._-]+/).filter(Boolean);
    return words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("");
  });

  function submitLogout(event: SubmitEvent) {
    if (!controller.submitLogout()) event.preventDefault();
  }
</script>

<div class="account-layout">
  <header class="account-header" aria-labelledby={`${componentId}-title`}>
    <!-- The link reads as its action. The picture stays unread: the heading beside it names the account. -->
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- The pure screen receives app-resolved URLs. -->
    <a class="picture" href={layout.pictureEditorHref}>
      <VisuallyHidden>{t("authUi.account.picture.changeLabel")}</VisuallyHidden>
      <Avatar
        label={profile?.username || (summary.status === "ready" && summary.email) || t("authUi.account.title")}
        src={profile?.picture}
        {initials}
        size="xl"
        aria-hidden="true"
      />
      <span class="badge" aria-hidden="true"><Camera size="var(--icon-size-sm)" /></span>
    </a>

    <div class="identity">
      <h1 id={`${componentId}-title`}>
        {#if profile?.username}
          <bdi>{profile.username}</bdi>
        {:else}
          {summary.status === "ready" && summary.email ? summary.email : t("authUi.account.title")}
        {/if}
      </h1>

      {#if summary.status === "error"}
        <Alert tone="error" title={t("authUi.account.loadErrorTitle")}>
          {translateAuthenticationFeedback(t, summary.feedback)}
        </Alert>
      {:else}
        <!-- Each role keeps one color, so a privileged account reads as such at a glance. -->
        <ul class="roles" aria-label={t("authUi.account.roles.label")}>
          {#each summary.roles as role (role)}
            <li>
              {#if role === Role.SuperAdmin}
                <Badge tone="danger">{t("authUi.account.roles.superAdmin")}</Badge>
              {:else if role === Role.Admin}
                <Badge tone="highlight">{t("authUi.account.roles.admin")}</Badge>
              {:else if role === Role.User}
                <Badge tone="brand">{t("authUi.account.roles.user")}</Badge>
              {:else}
                <Badge tone="neutral">{role}</Badge>
              {/if}
            </li>
          {/each}
        </ul>
        {#if summary.loggedInUntil}
          <p class="session">
            <span class="label">{t("authUi.account.loggedInUntil")}</span>
            {summary.loggedInUntil}
          </p>
        {/if}
      {/if}
    </div>

    <!-- Logging out is the one action here, and the header keeps it quiet: it is not what people come for. -->
    <form class="logout" method="POST" action={layout.logoutAction} onsubmit={submitLogout}>
      <Button type="submit" variant="text" tone="neutral" size="sm" disabled={layout.logoutState === "submitting"}>
        <LogOut size="var(--icon-size-sm)" aria-hidden="true" />
        {layout.logoutState === "submitting"
          ? t("authUi.account.logout.submitting")
          : t("authUi.account.logout.submit")}
      </Button>
    </form>
  </header>

  <nav class="tabs" aria-label={t("authUi.account.tabs.label")}>
    <NavList orientation="horizontal" items={tabs} />
  </nav>

  <div class="tab">
    {@render children()}
  </div>
</div>

<style>
  /* A full width up to its cap: the shell's column would shrink it to its content, which the
     container query hides, and a long email would then wrap at every character. */
  .account-layout {
    display: grid;
    gap: var(--space-6);
    box-sizing: border-box;
    container-type: inline-size;
    margin-inline: auto;
    padding-inline: var(--layout-gutter);
    padding-block: var(--space-6) var(--space-12);
    inline-size: 100%;
    /* Off the container scale on purpose: 48rem keeps a long email on one line beside the picture
       and the logout, where 40rem wraps it. */
    max-inline-size: 48rem;
  }

  .account-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-4) var(--space-6);
  }

  /* The picture fills its own column, and shrinks on a phone with Avatar's profile size; the camera
     badge tells that it opens the picture's editor. */
  .picture {
    display: grid;
    position: relative;
    border-radius: var(--radius-round);
    text-decoration: none;
  }

  .picture:hover .badge {
    background: var(--color-surface-hover);
  }

  .picture:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus-ring);
  }

  .badge {
    display: grid;
    position: absolute;
    place-items: center;
    inset-block-end: 0;
    inset-inline-end: 0;
    border: var(--border-width-thin) solid var(--color-border-default);
    border-radius: var(--radius-round);
    background: var(--color-surface-raised);
    inline-size: var(--control-height-sm);
    block-size: var(--control-height-sm);
    color: var(--color-text-primary);
  }

  .identity {
    display: grid;
    gap: var(--space-2);
    min-inline-size: 0;
  }

  h1,
  p,
  ul {
    margin: 0;
  }

  h1 {
    color: var(--color-text-primary);
    font-size: var(--font-size-2xl);
    line-height: var(--line-height-tight);
    font-family: var(--font-family-display);
    overflow-wrap: anywhere;
  }

  .roles {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    padding: 0;
    list-style: none;
  }

  .session {
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-normal);
  }

  .session .label {
    color: var(--color-text-muted);
  }

  /* The top corner, away from the details, so it reads as apart from the account. */
  .logout {
    align-self: start;
  }

  .tabs {
    border-block-end: var(--border-width-thin) solid var(--color-border-subtle);
    overflow-x: auto;
  }

  /* On a phone logging out moves under the details. */
  @container (max-width: 34rem) {
    .account-header {
      grid-template-columns: auto minmax(0, 1fr);
    }

    /* A full row, set apart from the details, so a thumb heading for the tabs does not land on it. */
    .logout {
      display: grid;
      grid-column: 1 / -1;
      margin-block-start: var(--space-2);
    }

    .logout :global(button) {
      justify-content: center;
    }
  }
</style>
