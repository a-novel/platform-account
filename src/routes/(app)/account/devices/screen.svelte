<script module lang="ts">
  import type { AccountDevicesController } from "./controller.svelte";

  /** Props for the pure devices tab. */
  export interface AccountDevicesScreenProps {
    controller: AccountDevicesController;
  }
</script>

<script lang="ts">
  import type { AccountDevice, AccountDeviceConfirmation } from "#lib/application/auth/types.js";
  import AuthenticationError from "#lib/ui/auth/AuthenticationError.svelte";

  import { followInPlace } from "../../link-transition";
  import { type DeviceList, pageOf } from "./device-pages";
  import LogoutDialog from "./logout-dialog.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Alert, Badge, Button, Card, Link, Pagination, Skeleton } from "@a-novel-kit/uikit";

  import { Monitor, Smartphone, Tablet } from "@lucide/svelte";

  let { controller }: AccountDevicesScreenProps = $props();

  const model = $derived(controller.state.model);
  const actions = $derived(controller.state.actions);
  const componentId = $props.id();
  const { t } = getI18nContext();

  const submitting = $derived(model.action.status === "submitting");
  const devices = $derived(model.devices.status === "ready" ? model.devices.devices : []);
  const active = $derived(devices.filter((device) => !device.loggedOut));
  const loggedOut = $derived(devices.filter((device) => device.loggedOut));
  const hasOthers = $derived(active.some((device) => !device.current));
  const activePage = $derived(pageOf(active, model.pages?.active ?? 1));
  const loggedOutPage = $derived(pageOf(loggedOut, model.pages?.loggedOut ?? 1));
  // The device a confirmation names, among those it may name: the active ones other than this one.
  const confirming = $derived.by(() => {
    const confirmation = model.confirmation;
    if (confirmation?.kind !== "device") return undefined;
    return active.find((device) => device.id === confirmation.id && !device.current);
  });
  const icons = { desktop: Monitor, phone: Smartphone, tablet: Tablet };

  function deviceName(device: AccountDevice): string {
    if (device.browser && device.system) {
      return t("authUi.account.devices.name", { browser: device.browser, system: device.system });
    }
    if (device.system) return t("authUi.account.devices.nameUnknownBrowser", { system: device.system });
    return device.browser ?? t("authUi.account.devices.unknown");
  }

  function activity(device: AccountDevice): string {
    if (device.current) return t("authUi.account.devices.activeNow");
    return t("authUi.account.devices.lastActive", { date: device.lastActiveAt });
  }

  function submitChange(event: SubmitEvent) {
    if (!controller.submitChange()) event.preventDefault();
  }
</script>

{#snippet deviceRow(device: AccountDevice, name: string)}
  {@const Icon = icons[device.form]}
  <Icon size="var(--icon-size-md)" aria-hidden="true" />
  <div class="device">
    <p class="name">
      <span>{name}</span>
      {#if device.current}<Badge tone="brand">{t("authUi.account.devices.current")}</Badge>{/if}
    </p>
    <p class="secondary">{activity(device)}</p>
    {#if device.place || device.ipAddress}
      <p class="secondary">{[device.place, device.ipAddress].filter(Boolean).join(" · ")}</p>
    {/if}
  </div>
{/snippet}

{#snippet deviceAction(action: string, label: string, accessibleName: string, device?: AccountDevice)}
  <form class="action" method="POST" {action} aria-busy={submitting} onsubmit={submitChange}>
    {#if device}<input type="hidden" name="sessionID" value={device.id} />{/if}
    <Button type="submit" variant="outline" tone="neutral" size="sm" aria-label={accessibleName} disabled={submitting}>
      {label}
    </Button>
  </form>
{/snippet}

<!-- Logging another device out takes effect within 15 minutes, so it asks first and says so. -->
{#snippet confirmLink(confirmation: AccountDeviceConfirmation, label: string, accessibleName?: string)}
  <div class="action">
    <Button
      href={controller.confirmationHref(confirmation)}
      variant="outline"
      tone="neutral"
      size="sm"
      aria-label={accessibleName}
      onclick={(event: MouseEvent) => followInPlace(event, () => controller.openConfirmation(confirmation))}
    >
      {label}
    </Button>
  </div>
{/snippet}

{#snippet pagination(list: DeviceList, current: { page: number; totalPages: number }, label: string)}
  {#if current.totalPages > 1}
    <Pagination
      data-sveltekit-noscroll
      currentPage={current.page}
      totalPages={current.totalPages}
      getHref={(page) => controller.pageHref(list, page)}
      {label}
    />
  {/if}
{/snippet}

<div class="devices-tab">
  {#if model.locationConsent === false}
    <Alert tone="info" role="note" title={t("authUi.account.devices.locationTip.title")}>
      {t("authUi.account.devices.locationTip.body")}
      <Link href={controller.state.privacyHref}>{t("authUi.account.devices.locationTip.link")}</Link>
    </Alert>
  {/if}

  <Card surface="raised">
    <section class="group" aria-labelledby={`${componentId}-active`}>
      <header>
        <h2 id={`${componentId}-active`}>{t("authUi.account.devices.title")}</h2>
        <p class="secondary">{t("authUi.account.devices.description")}</p>
      </header>

      <!-- A change's outcome sits with the list it changed, under the title that names it. -->
      {#if model.action.status === "logged-out" || model.action.status === "logged-out-others"}
        {@const title =
          model.action.status === "logged-out"
            ? t("authUi.account.devices.loggedOut")
            : t("authUi.account.devices.loggedOutOthers")}
        <Alert tone="success" {title} />
      {:else if model.action.status === "removed"}
        <Alert tone="success" title={t("authUi.account.devices.removed")} />
      {:else if model.action.status === "service-error"}
        <AuthenticationError feedback={model.action.feedback} />
      {/if}

      {#if model.devices.status === "unavailable"}
        <Alert tone="error" title={t("authUi.account.devices.unavailable")} />
      {:else if model.devices.status === "loading"}
        <!-- Without scripts no retry runs, so the failure shows at once. -->
        <noscript><Alert tone="error" title={t("authUi.account.devices.unavailable")} /></noscript>
        <div class="loading">
          <Skeleton shape="rectangle" />
          <Skeleton shape="rectangle" />
        </div>
      {:else}
        <ul>
          {#each activePage.items as device (device.id)}
            {@const name = deviceName(device)}
            <li>
              {@render deviceRow(device, name)}
              {#if device.current}
                {@render deviceAction(
                  actions.logout,
                  t("authUi.account.devices.logout"),
                  t("authUi.account.devices.logoutLabel", { device: name })
                )}
              {:else}
                {@render confirmLink(
                  { kind: "device", id: device.id },
                  t("authUi.account.devices.logout"),
                  t("authUi.account.devices.logoutLabel", { device: name })
                )}
              {/if}
            </li>
          {/each}
        </ul>
        {@render pagination("active", activePage, t("authUi.account.devices.pagination.active"))}
      {/if}

      {#if hasOthers}
        <footer>
          {@render confirmLink({ kind: "others" }, t("authUi.account.devices.logoutOthers"))}
        </footer>
      {/if}
    </section>
  </Card>

  {#if loggedOut.length > 0}
    <Card surface="raised">
      <section class="group" aria-labelledby={`${componentId}-logged-out`}>
        <header>
          <h2 id={`${componentId}-logged-out`}>{t("authUi.account.devices.loggedOutTitle")}</h2>
          <p class="secondary">{t("authUi.account.devices.loggedOutDescription")}</p>
          <p class="hint">{t("authUi.account.devices.lossDelay")}</p>
        </header>
        <ul>
          {#each loggedOutPage.items as device (device.id)}
            {@const name = deviceName(device)}
            <li class="logged-out">
              {@render deviceRow(device, name)}
              {@render deviceAction(
                actions.removeDevice,
                t("authUi.account.devices.remove"),
                t("authUi.account.devices.removeLabel", { device: name }),
                device
              )}
            </li>
          {/each}
        </ul>
        {@render pagination("loggedOut", loggedOutPage, t("authUi.account.devices.pagination.loggedOut"))}
      </section>
    </Card>
  {/if}
</div>

{#if model.confirmation?.kind === "others" || confirming}
  <LogoutDialog {controller} device={confirming} deviceName={confirming && deviceName(confirming)} />
{/if}

<style>
  .devices-tab,
  .group,
  header {
    display: grid;
    gap: var(--space-4);
    min-inline-size: 0;
  }

  .group {
    container-type: inline-size;
  }

  header {
    gap: var(--space-2);
  }

  h2,
  p {
    margin: 0;
  }

  h2 {
    color: var(--color-text-primary);
    font-size: var(--font-size-xl);
    font-family: var(--font-family-display);
  }

  .secondary {
    color: var(--color-text-secondary);
    line-height: var(--line-height-normal);
  }

  .hint {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-normal);
  }

  .loading {
    display: grid;
    gap: var(--space-3);
  }

  ul {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-3);
    padding-block: var(--space-3);
  }

  li + li {
    border-block-start: var(--border-width-thin) solid var(--color-border-subtle);
  }

  li > :global(svg) {
    color: var(--color-text-secondary);
  }

  /* A logged-out device recedes: it only waits to be removed. */
  .logged-out > :global(svg),
  .logged-out .name,
  .logged-out .secondary {
    color: var(--color-text-muted);
  }

  .device {
    display: grid;
    gap: var(--space-1);
    min-inline-size: 0;
  }

  .name {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text-primary);
    overflow-wrap: anywhere;
  }

  /*
   * A narrow card leaves the device's name its full line. Its action takes a full row below, set apart from the
   * details so a scrolling thumb does not land on it.
   */
  @container (max-width: 28rem) {
    li {
      grid-template-columns: auto minmax(0, 1fr);
      align-items: start;
    }

    .action {
      display: grid;
      grid-column: 1 / -1;
      margin-block-start: var(--space-2);
    }

    .action > :global(*) {
      justify-content: center;
    }
  }
</style>
