<script lang="ts">
  import TelemetrySetting from "#lib/ui/TelemetrySetting.svelte";
  import AuthenticationError from "#lib/ui/auth/AuthenticationError.svelte";

  import type { LocationConsentController } from "./controller.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import type { TelemetryPreference } from "@a-novel-kit/nodelib-svelte";
  import { Button, Card, Section, Skeleton, Switch } from "@a-novel-kit/uikit";

  let {
    telemetry,
    location,
    locationConsentAction = "?/locationConsent",
  }: {
    /** The visitor's telemetry answer, or null on a platform that collects no browser telemetry and asks nothing. */
    telemetry: TelemetryPreference | null;
    /** The account's location consent and its switch. */
    location: LocationConsentController;
    /** Where the location consent form posts. */
    locationConsentAction?: string;
  } = $props();

  const { t } = getI18nContext();

  /** The switch's own change runs first, so the form submits the answer it just recorded. */
  function submitOnChange(event: Event & { currentTarget: HTMLFormElement }) {
    if (location.pending) event.currentTarget.requestSubmit();
  }
</script>

<div class="privacy-tab">
  <Section title={t("privacy.account.title")}>
    <Card surface="raised">
      {#if location.account.status === "ready"}
        {@const account = location.account}
        <form method="POST" action={locationConsentAction} aria-busy={location.pending} onchange={submitOnChange}>
          <Switch
            class="setting"
            name="enabled"
            controller={location.consent}
            label={t("privacy.account.locationTitle")}
            description={t("privacy.account.locationDescription")}
          />
          {#if account.feedback}
            <AuthenticationError feedback={account.feedback} />
          {/if}
          <noscript>
            <Button type="submit" variant="outline" tone="neutral" size="sm">{t("privacy.account.save")}</Button>
          </noscript>
        </form>
      {:else}
        <div class="setting-skeleton">
          <Skeleton class="setting-skeleton-title" />
          <Skeleton />
        </div>
      {/if}
    </Card>
  </Section>

  <Section title={t("privacy.device.title")}>
    <Card surface="raised">
      <TelemetrySetting {telemetry} />
    </Card>
  </Section>
</div>

<style>
  .privacy-tab,
  form {
    display: grid;
    gap: var(--space-3);
  }

  .privacy-tab {
    gap: var(--space-8);
  }

  .privacy-tab :global(.setting) {
    display: flex;
  }

  .setting-skeleton {
    display: grid;
    gap: var(--space-2);
  }

  .setting-skeleton :global(.setting-skeleton-title) {
    inline-size: 40%;
  }
</style>
