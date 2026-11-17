<script lang="ts">
  import CloseLink from "../../close-link.svelte";
  import { followInPlace } from "../../link-transition";
  import type { AccountDevice, AccountDevicesController } from "./controller.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Button, Dialog, FormActions } from "@a-novel-kit/uikit";

  let {
    controller,
    device,
    deviceName,
  }: {
    controller: AccountDevicesController;
    /** The device the confirmation names, absent when it asks about every other device. */
    device?: AccountDevice;
    /** The device's name, as its row shows it. */
    deviceName?: string;
  } = $props();

  const { t } = getI18nContext();

  const actions = $derived(controller.state.actions);
  const submitting = $derived(controller.state.model.action.status === "submitting");
  const close = (event: MouseEvent) => followInPlace(event, controller.confirmation.close);

  function submit(event: SubmitEvent) {
    if (!controller.submitChange()) event.preventDefault();
  }
</script>

<Dialog
  controller={controller.confirmation}
  title={device
    ? t("account.devices.confirm.deviceTitle", { device: deviceName ?? "" })
    : t("account.devices.confirm.othersTitle")}
  size="sm"
>
  {#snippet headerActions()}
    <CloseLink
      label={t("account.closeEditor")}
      href={controller.confirmationHref(null)}
      onclose={controller.confirmation.close}
    />
  {/snippet}

  <form
    class="confirmation"
    method="POST"
    action={device ? actions.logoutDevice : actions.logoutOtherDevices}
    aria-busy={submitting}
    onsubmit={submit}
  >
    {#if !device}
      <p>{t("account.devices.confirm.othersBody")}</p>
    {/if}
    <p class="secondary">{t("account.devices.lossDelay")}</p>
    {#if device}<input type="hidden" name="sessionID" value={device.id} />{/if}

    <FormActions>
      <Button href={controller.confirmationHref(null)} variant="outline" tone="neutral" onclick={close}>
        {t("account.devices.confirm.cancel")}
      </Button>
      <Button type="submit" tone="danger" disabled={submitting}>
        {device ? t("account.devices.logout") : t("account.devices.logoutOthers")}
      </Button>
    </FormActions>
  </form>
</Dialog>

<style>
  .confirmation {
    display: grid;
    gap: var(--space-4);
  }

  p {
    margin: 0;
    color: var(--color-text-primary);
    line-height: var(--line-height-normal);
  }

  .secondary {
    color: var(--color-text-secondary);
  }
</style>
