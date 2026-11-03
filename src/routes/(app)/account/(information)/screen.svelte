<script module lang="ts">
  import type { AccountInformationController } from "./controller.svelte";

  /** Props for the pure "My information" tab. */
  export interface AccountInformationScreenProps {
    controller: AccountInformationController;
  }
</script>

<script lang="ts">
  import type { AccountEditor } from "#lib/application/auth/types.js";

  import { followInPlace } from "../../link-transition";
  import EmailDialog from "./email-dialog.svelte";
  import PasswordDialog from "./password-dialog.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Alert, Button, Card } from "@a-novel-kit/uikit";

  import { Hourglass } from "@lucide/svelte";

  let { controller }: AccountInformationScreenProps = $props();

  const credentials = $derived(controller.state.model.credentials);
  const componentId = $props.id();
  const { t } = getI18nContext();

  const openEditor = (editor: AccountEditor) => (event: MouseEvent) =>
    followInPlace(event, controller.editors[editor].open);
</script>

<Card surface="raised">
  <section class="information" aria-labelledby={`${componentId}-title`}>
    <h2 id={`${componentId}-title`}>{t("authUi.account.signIn.title")}</h2>
    <dl>
      <div>
        <dt>{t("authUi.account.email.title")}</dt>
        <dd>
          <div class="row">
            {#if credentials.status === "ready"}
              <span class="value">{credentials.email}</span>
            {/if}
            <Button
              variant="text"
              size="sm"
              href={controller.editorHref("email")}
              aria-label={t("authUi.account.email.changeLabel")}
              onclick={openEditor("email")}
            >
              {t("authUi.account.email.change")}
            </Button>
          </div>
          {#if credentials.status === "unavailable"}
            <Alert tone="error" title={t("authUi.account.email.unavailable")} />
          {:else if credentials.pendingEmail}
            {@const pending = credentials.pendingEmail}
            <Alert tone="info" role="note" title={t("authUi.account.email.pending")}>
              {#snippet icon()}
                <Hourglass size="var(--icon-size-sm)" />
              {/snippet}
              <span class="pending-email">{pending.email}</span>
              {t("authUi.account.email.pendingExpiry", { date: pending.expiresAt })}
            </Alert>
          {/if}
        </dd>
      </div>
      <div>
        <dt>{t("authUi.account.password.title")}</dt>
        <dd>
          <div class="row">
            <span class="secondary" aria-hidden="true">••••••••</span>
            <Button
              variant="text"
              size="sm"
              href={controller.editorHref("password")}
              aria-label={t("authUi.account.password.changeLabel")}
              onclick={openEditor("password")}
            >
              {t("authUi.account.password.change")}
            </Button>
          </div>
        </dd>
      </div>
    </dl>
  </section>
</Card>

<EmailDialog {controller} />
<PasswordDialog {controller} />

<style>
  .information,
  dl,
  dd,
  dl > div {
    display: grid;
    margin: 0;
    min-inline-size: 0;
  }

  .information {
    gap: var(--space-4);
  }

  dl {
    gap: var(--space-4);
  }

  dl > div {
    gap: var(--space-1);
  }

  dd {
    gap: var(--space-3);
  }

  h2 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-xl);
    font-family: var(--font-family-display);
  }

  dt {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-3);
    min-inline-size: 0;
  }

  .value {
    color: var(--color-text-primary);
    overflow-wrap: anywhere;
  }

  .secondary {
    color: var(--color-text-secondary);
  }

  .pending-email {
    display: block;
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    overflow-wrap: anywhere;
  }
</style>
