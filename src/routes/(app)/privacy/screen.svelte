<script lang="ts">
  import TelemetrySetting from "#lib/ui/TelemetrySetting.svelte";
  import type { TelemetryPreference } from "#lib/ui/telemetry-preference.js";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Card, Container, PageHeader, Stack } from "@a-novel-kit/uikit";

  let {
    telemetry,
  }: {
    /** The visitor's telemetry answer, or null on a platform that collects no browser telemetry and asks nothing. */
    telemetry: TelemetryPreference | null;
  } = $props();

  const { t } = getI18nContext();
</script>

<div class="privacy-screen">
  <Container size="sm" gutter={false}>
    <Stack gap="4">
      <PageHeader title={t("privacy.title")} description={t("privacy.description")} />
      <Card surface="raised">
        <TelemetrySetting {telemetry} />
      </Card>
    </Stack>
  </Container>
</div>

<style>
  .privacy-screen {
    padding-inline: var(--layout-gutter);
    padding-block: var(--space-6) var(--space-12);
  }
</style>
