<script module lang="ts">
  import type { AccountDevicesController } from "./controller.svelte";

  /** Props for the pure devices tab. */
  interface AccountDevicesScreenProps {
    controller: AccountDevicesController;
  }
</script>

<script lang="ts">
  import AuthenticationError from "#lib/ui/auth/AuthenticationError.svelte";
  import { submitThrough } from "#lib/ui/form-submission.js";

  import { followInPlace } from "../../link-transition";
  import type { AccountDevice, AccountDeviceConfirmation } from "./controller.svelte";
  import { type DeviceList, pageOf } from "./device-pages";
  import LogoutDialog from "./logout-dialog.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Alert, Badge, Button, Card, Link, Pagination, Section, Skeleton } from "@a-novel-kit/uikit";

  import { Monitor, Smartphone, Tablet } from "@lucide/svelte";

  let { controller }: AccountDevicesScreenProps = $props();

  const model = $derived(controller.state.model);
  const actions = $derived(controller.state.actions);
  const { t } = getI18nContext();
  const submitChange = (event: SubmitEvent) => submitThrough(event, () => controller.submitChange());

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
      return t("account.devices.name", { browser: device.browser, system: device.system });
    }
    if (device.system) return t("account.devices.nameUnknownBrowser", { system: device.system });
    return device.browser ?? t("account.devices.unknown");
  }

  function activity(device: AccountDevice): string {
    if (device.current) return t("account.devices.activeNow");
    return t("account.devices.lastActive", { date: device.lastActiveAt });
  }
</script>

{#snippet deviceRow(device: AccountDevice, name: string)}
  {@const Icon = icons[device.form]}
  <Icon size="var(--icon-size-md)" aria-hidden="true" />
  <div class="device">
    <p class="name">
      <span>{name}</span>
      {#if device.current}<Badge tone="brand">{t("account.devices.current")}</Badge>{/if}
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
{/snippet}

<!-- Logging every other device out acts on the whole list, so it sits beside the list's title. -->
{#snippet logoutOthers()}
  {@render confirmLink({ kind: "others" }, t("account.devices.logoutOthers"))}
{/snippet}

<!-- Removing every logged-out device acts on its whole list. Like a single removal, it asks for no confirmation. -->
{#snippet removeAll()}
  {@render deviceAction(
    actions.removeLoggedOutDevices,
    t("account.devices.removeAll"),
    t("account.devices.removeAllLabel")
  )}
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
    <Alert tone="info" role="note" title={t("account.devices.locationTip.title")}>
      {t("account.devices.locationTip.body")}
      <Link href={controller.state.privacyHref}>{t("account.devices.locationTip.link")}</Link>
    </Alert>
  {/if}

  <Section
    title={t("account.devices.title")}
    description={t("account.devices.description")}
    actions={hasOthers ? logoutOthers : undefined}
  >
    <!-- A change's outcome sits with the list it changed, under the title that names it. -->
    {#if model.action.status === "logged-out" || model.action.status === "logged-out-others"}
      {@const title =
        model.action.status === "logged-out" ? t("account.devices.loggedOut") : t("account.devices.loggedOutOthers")}
      <Alert tone="success" {title} />
    {:else if model.action.status === "removed" || model.action.status === "removed-all"}
      {@const title =
        model.action.status === "removed" ? t("account.devices.removed") : t("account.devices.removedAll")}
      <Alert tone="success" {title} />
    {:else if model.action.status === "service-error"}
      <AuthenticationError feedback={model.action.feedback} />
    {/if}

    {#if model.devices.status === "unavailable"}
      <Alert tone="error" title={t("account.devices.unavailable")} />
    {:else}
      <Card surface="raised">
        <div class="group">
          {#if model.devices.status === "loading"}
            <!-- Without scripts no retry runs, so the failure shows at once. -->
            <noscript><Alert tone="error" title={t("account.devices.unavailable")} /></noscript>
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
                      t("account.devices.logout"),
                      t("account.devices.logoutLabel", { device: name })
                    )}
                  {:else}
                    <div class="action">
                      {@render confirmLink(
                        { kind: "device", id: device.id },
                        t("account.devices.logout"),
                        t("account.devices.logoutLabel", { device: name })
                      )}
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
            {@render pagination("active", activePage, t("account.devices.pagination.active"))}
          {/if}
        </div>
      </Card>
    {/if}
  </Section>

  {#if loggedOut.length > 0}
    <Section
      title={t("account.devices.loggedOutTitle")}
      description={`${t("account.devices.loggedOutDescription")} ${t("account.devices.lossDelay")}`}
      actions={loggedOut.length > 1 ? removeAll : undefined}
    >
      <Card surface="raised">
        <div class="group">
          <ul>
            {#each loggedOutPage.items as device (device.id)}
              {@const name = deviceName(device)}
              <li class="logged-out">
                {@render deviceRow(device, name)}
                {@render deviceAction(
                  actions.removeDevice,
                  t("account.devices.remove"),
                  t("account.devices.removeLabel", { device: name }),
                  device
                )}
              </li>
            {/each}
          </ul>
          {@render pagination("loggedOut", loggedOutPage, t("account.devices.pagination.loggedOut"))}
        </div>
      </Card>
    </Section>
  {/if}
</div>

{#if model.confirmation?.kind === "others" || confirming}
  <LogoutDialog {controller} device={confirming} deviceName={confirming && deviceName(confirming)} />
{/if}

<style>
  .devices-tab,
  .group {
    display: grid;
    gap: var(--space-4);
    min-inline-size: 0;
  }

  .devices-tab {
    gap: var(--space-8);
  }

  p {
    margin: 0;
  }

  /* Every line under a device's name is interface text. */
  .secondary {
    color: var(--color-text-secondary);
    font: var(--text-ui);
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
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: var(--space-3);
    padding-block: var(--space-3);
  }

  li + li {
    border-block-start: var(--border-width-thin) solid var(--color-border-divider);
  }

  /* The card's own inset frames the list: its first and last rows add none. */
  li:first-child {
    padding-block-start: 0;
  }

  li:last-child {
    padding-block-end: 0;
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
    font: var(--text-body);
    overflow-wrap: anywhere;
  }

  .action {
    display: grid;
  }

  .action > :global(*) {
    justify-content: center;
  }

  /*
   * Below 35rem, as uikit's ActionGroup lays out actions, the device's name keeps its full line and its action takes
   * a full row below, set apart from the details so a scrolling thumb does not land on it. A list's own action stays
   * beside its title.
   */
  li > .action {
    grid-column: 1 / -1;
    margin-block-start: var(--space-2);
  }

  /* From 35rem an action fits its label at the end of its row. */
  @media (min-width: 35rem) {
    li {
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
    }

    li > .action {
      grid-column: auto;
      justify-items: end;
      margin-block-start: 0;
    }
  }
</style>
