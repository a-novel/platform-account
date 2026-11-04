<!-- @component The device's telemetry answer as a switch, or a note when the platform collects nothing. -->
<script lang="ts">
  import type { TelemetryPreference } from "./telemetry-preference";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Switch, type SwitchController } from "@a-novel-kit/uikit";

  let {
    telemetry,
  }: {
    /** The visitor's telemetry answer, or null on a platform that collects no browser telemetry and asks nothing. */
    telemetry: TelemetryPreference | null;
  } = $props();

  const { t } = getI18nContext();

  const telemetrySwitch: SwitchController = {
    get state() {
      return { checked: telemetry?.choice === "accepted" };
    },
    setChecked: (checked) => telemetry?.choose(checked ? "accepted" : "declined"),
    toggle: () => telemetry?.choose(telemetry.choice === "accepted" ? "declined" : "accepted"),
  };
</script>

{#if telemetry}
  <Switch
    class="telemetry-setting"
    controller={telemetrySwitch}
    label={t("telemetryConsent.title")}
    description={t("telemetryConsent.message")}
    disabled={telemetry.pending}
  />
{:else}
  <p>{t("privacy.noTelemetry")}</p>
{/if}

<style>
  :global(.telemetry-setting) {
    display: flex;
  }

  p {
    margin: 0;
    color: var(--color-text-secondary);
    line-height: var(--line-height-normal);
  }
</style>
