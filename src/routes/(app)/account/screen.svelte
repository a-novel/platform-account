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
  import { Alert, Badge, Button, NavList } from "@a-novel-kit/uikit";
  import { Role } from "@a-novel/service-authentication-rest";

  import { LogOut } from "@lucide/svelte";

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

  // The picture shows initials until the account can upload one: two from a dotted or dashed handle.
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
    <span class="picture" aria-hidden="true">{initials}</span>

    <div class="identity">
      <h1 id={`${componentId}-title`}>
        {summary.status === "ready" && summary.email ? summary.email : t("authUi.account.title")}
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
  .account-layout {
    display: grid;
    gap: var(--space-6);
    container-type: inline-size;
    margin-inline: auto;
    padding-inline: var(--layout-gutter);
    padding-block: var(--space-6) var(--space-12);
    max-inline-size: 48rem;
  }

  .account-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-4) var(--space-6);
  }

  /* The picture fills its own column, where an uploaded picture will take its place. */
  .picture {
    display: grid;
    place-items: center;
    border: var(--border-width-thin) solid var(--color-border-default);
    border-radius: var(--radius-round);
    background: var(--color-surface-selected);
    inline-size: 6rem;
    block-size: 6rem;
    color: var(--color-text-accent);
    font-weight: var(--font-weight-bold);
    font-size: var(--font-size-2xl);
    font-family: var(--font-family-mono);
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

  .tabs {
    border-block-end: var(--border-width-thin) solid var(--color-border-subtle);
    overflow-x: auto;
  }

  /* On a phone the picture shrinks, and logging out moves under the details. */
  @container (max-width: 34rem) {
    .account-header {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .picture {
      inline-size: 4rem;
      block-size: 4rem;
      font-size: var(--font-size-xl);
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
