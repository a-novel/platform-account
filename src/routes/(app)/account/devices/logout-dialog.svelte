<script lang="ts">
  import type { AccountDevice } from "#lib/application/auth/types.js";

  import { followInPlace } from "../../link-transition";
  import type { AccountDevicesController } from "./controller.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Button, Dialog, IconButton } from "@a-novel-kit/uikit";

  import { X } from "@lucide/svelte";

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
    ? t("authUi.account.devices.confirm.deviceTitle", { device: deviceName ?? "" })
    : t("authUi.account.devices.confirm.othersTitle")}
  size="sm"
>
  {#snippet headerActions()}
    <IconButton
      label={t("authUi.account.closeEditor")}
      variant="ghost"
      tone="neutral"
      size="sm"
      href={controller.confirmationHref(null)}
      onclick={close}
    >
      <X size="var(--icon-size-sm)" aria-hidden="true" />
    </IconButton>
  {/snippet}

  <div class="confirmation">
    {#if !device}
      <p>{t("authUi.account.devices.confirm.othersBody")}</p>
    {/if}
    <p class="secondary">{t("authUi.account.devices.lossDelay")}</p>

    <form
      method="POST"
      action={device ? actions.logoutDevice : actions.logoutOtherDevices}
      aria-busy={submitting}
      onsubmit={submit}
    >
      {#if device}<input type="hidden" name="sessionID" value={device.id} />{/if}
      <Button href={controller.confirmationHref(null)} variant="outline" tone="neutral" onclick={close}>
        {t("authUi.account.devices.confirm.cancel")}
      </Button>
      <Button type="submit" tone="danger" disabled={submitting}>
        {device ? t("authUi.account.devices.logout") : t("authUi.account.devices.logoutOthers")}
      </Button>
    </form>
  </div>
</Dialog>

<style>
  .confirmation {
    display: grid;
    gap: var(--space-4);
  }

  form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: var(--space-3);
    margin-block-start: var(--space-4);
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
