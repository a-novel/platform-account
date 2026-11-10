<script lang="ts">
  import { translateFieldIssue } from "#lib/i18n/auth-feedback.js";
  import AuthenticationError from "#lib/ui/auth/AuthenticationError.svelte";
  import { submitThrough } from "#lib/ui/form-submission.js";

  import { followInPlace } from "../../link-transition";
  import type { AccountInformationController } from "./controller.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Button, Dialog, Field, FormActions, IconButton, Input, PasswordInput } from "@a-novel-kit/uikit";

  import { MailCheck, X } from "@lucide/svelte";

  let { controller }: { controller: AccountInformationController } = $props();

  const model = $derived(controller.state.model);
  const credentials = $derived(model.credentials);
  const componentId = $props.id();
  const { t } = getI18nContext();

  const sent = $derived(model.emailState.status === "pending-email");
  const submitting = $derived(model.emailState.status === "submitting");
  const issues = $derived(model.emailState.status === "validation-error" ? model.emailState.issues : []);
  const submit = (event: SubmitEvent) => submitThrough(event, (form) => controller.submitEmail(form));
  const close = (event: MouseEvent) => followInPlace(event, controller.editors.email.close);
</script>

<!-- Renders a message with its one interpolated value set apart. The value appears once, in any language. -->
{#snippet emphasized(message: string, value: string, tone: "accent" | "strong")}
  {@const [before, ...after] = message.split(value)}
  {before}<strong class={tone}>{value}</strong>{after.join(value)}
{/snippet}

{#snippet sentTitle()}
  <span class="success-title">
    <MailCheck size="var(--icon-size-md)" aria-hidden="true" />
    {t("authUi.account.email.success.title")}
  </span>
{/snippet}

<Dialog
  controller={controller.editors.email}
  title={sent ? sentTitle : t("authUi.account.email.dialogTitle")}
  description={sent ? undefined : t("authUi.account.email.description")}
  size="sm"
>
  {#snippet headerActions()}
    <IconButton
      label={t("authUi.account.closeEditor")}
      variant="ghost"
      tone="neutral"
      size="sm"
      href={controller.editorHref(null)}
      onclick={close}
    >
      <X size="var(--icon-size-sm)" aria-hidden="true" />
    </IconButton>
  {/snippet}

  {#if sent}
    <!-- The service answers alike whether or not another account uses the address, and so does this screen. -->
    <div class="success" role="status">
      {#if credentials.status === "ready" && credentials.pendingEmail}
        {@const pending = credentials.pendingEmail}
        <p
          >{@render emphasized(
            t("authUi.account.email.success.sent", { email: pending.email }),
            pending.email,
            "accent"
          )}</p
        >
        <p class="secondary">{t("authUi.account.email.success.expiry", { date: pending.expiresAt })}</p>
      {:else}
        <p>{t("authUi.account.email.pendingDescription")}</p>
      {/if}
      {#if credentials.status === "ready"}
        <p class="secondary">
          {@render emphasized(
            t("authUi.account.email.success.keep", { email: credentials.email }),
            credentials.email,
            "strong"
          )}
        </p>
      {/if}
      <Button href={controller.editorHref(null)} onclick={close}>{t("authUi.account.gotIt")}</Button>
    </div>
  {:else}
    <form method="POST" action={controller.state.actions.email} aria-busy={submitting} novalidate onsubmit={submit}>
      <Field
        controlId={`${componentId}-new-email`}
        label={t("authUi.account.email.label")}
        hint={t("authUi.account.email.hint")}
        error={translateFieldIssue(t, issues, "newEmail")}
        required
      >
        {#snippet children(control)}
          <Input
            {...control}
            name="email"
            value={model.emailDraft}
            type="email"
            autocomplete="email"
            autocapitalize="none"
            spellcheck="false"
            readonly={submitting}
          />
        {/snippet}
      </Field>
      <Field
        controlId={`${componentId}-current-password`}
        label={t("authUi.account.password.currentLabel")}
        error={translateFieldIssue(t, issues, "currentPassword")}
        required
      >
        {#snippet children(control)}
          <PasswordInput
            {...control}
            controller={controller.passwordVisibility.emailCurrentPassword}
            name="currentPassword"
            autocomplete="current-password"
            readonly={submitting}
          />
        {/snippet}
      </Field>
      <FormActions align="stretch">
        {#snippet feedback()}
          {#if model.emailState.status === "service-error"}
            <AuthenticationError feedback={model.emailState.feedback} />
          {/if}
        {/snippet}
        <Button type="submit" disabled={submitting}>
          {submitting ? t("authUi.account.email.submitting") : t("authUi.account.email.submit")}
        </Button>
      </FormActions>
    </form>
  {/if}
</Dialog>

<style>
  form,
  .success {
    display: grid;
    gap: var(--space-4);
  }

  .success-title {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .success-title > :global(svg) {
    flex: none;
    color: var(--color-text-accent);
  }

  .success > :global(:last-child) {
    margin-block-start: var(--space-4);
  }

  strong {
    font-weight: var(--font-weight-bold);
  }

  /* The address the link went to leads; the current one stands out less, against its quieter sentence. */
  .accent {
    color: var(--color-text-accent);
  }

  .strong {
    color: var(--color-text-primary);
  }

  p {
    margin: 0;
    color: var(--color-text-primary);
    line-height: var(--line-height-normal);
    overflow-wrap: anywhere;
  }

  .secondary {
    color: var(--color-text-secondary);
  }
</style>
