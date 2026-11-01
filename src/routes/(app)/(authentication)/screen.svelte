<script module lang="ts">
  import type { AuthenticationPanelController } from "./controller.svelte";

  /** Props for the pure form rendered inside the shell authentication dialog. */
  export interface AuthenticationPanelProps {
    controller: AuthenticationPanelController;
  }
</script>

<script lang="ts">
  import type { AuthenticationField } from "#lib/application/auth/types.js";
  import { translateFieldIssue } from "#lib/i18n/auth-feedback.js";
  import AuthenticationError from "#lib/ui/auth/AuthenticationError.svelte";
  import { submitThrough } from "#lib/ui/form-submission.js";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Alert, Button, Field, FormActions, InlineMessage, Input, PasswordInput } from "@a-novel-kit/uikit";

  let { controller }: AuthenticationPanelProps = $props();

  const model = $derived(controller.state.model);
  const action = $derived(controller.state.action);

  const { t } = getI18nContext();
  const componentId = $props.id();
  const emailId = `${componentId}-email`;
  const passwordId = `${componentId}-password`;
  const submitting = $derived(model.state.status === "submitting");
  const issues = $derived(model.state.status === "validation-error" ? model.state.issues : []);

  const fieldError = (field: AuthenticationField) => translateFieldIssue(t, issues, field);
  const submit = (event: SubmitEvent) => submitThrough(event, (form) => controller.submit(form));
</script>

{#if model.state.status === "pending-email"}
  {@const targetHint = model.state.targetHint}
  <InlineMessage tone="success">
    {t("authUi.authentication.journeys.reset.pendingDescription")} <strong class="pending-target">{targetHint}</strong>
  </InlineMessage>
{:else if model.state.status === "recorded"}
  <InlineMessage tone="success">
    {t("authUi.authentication.journeys.register.recordedDescription")}
    <strong class="pending-target">{model.state.email}</strong>
  </InlineMessage>
{:else}
  <form method="POST" {action} aria-busy={submitting} novalidate onsubmit={submit}>
    <Field controlId={emailId} label={t("authUi.authentication.emailLabel")} error={fieldError("email")} required>
      {#snippet children(control)}
        <Input
          {...control}
          name="email"
          type="email"
          autocomplete={model.journey === "login" ? "username" : "email"}
          autocapitalize="none"
          spellcheck="false"
          readonly={submitting}
        />
      {/snippet}
    </Field>

    {#if model.journey === "login"}
      <Field
        controlId={passwordId}
        label={t("authUi.authentication.passwordLabel")}
        error={fieldError("password")}
        required
      >
        {#snippet children(control)}
          <PasswordInput
            {...control}
            controller={controller.passwordVisibility}
            name="password"
            autocomplete="current-password"
            readonly={submitting}
          />
        {/snippet}
      </Field>
    {/if}

    <FormActions>
      {#snippet feedback()}
        {#if model.state.status === "service-error"}
          <AuthenticationError feedback={model.state.feedback} />
        {:else if model.state.status === "conflict"}
          <Alert
            tone="warning"
            title={model.state.code === "account_exists"
              ? t("authUi.authentication.journeys.register.accountExists")
              : t("authUi.authentication.journeys.register.alreadyWaitlisted")}
          />
        {/if}
      {/snippet}
      <Button type="submit" disabled={submitting}>
        {#if model.journey === "register"}
          {submitting
            ? t("authUi.authentication.journeys.register.submitting")
            : t("authUi.authentication.journeys.register.submit")}
        {:else if model.journey === "reset"}
          {submitting
            ? t("authUi.authentication.journeys.reset.submitting")
            : t("authUi.authentication.journeys.reset.submit")}
        {:else}
          {submitting
            ? t("authUi.authentication.journeys.login.submitting")
            : t("authUi.authentication.journeys.login.submit")}
        {/if}
      </Button>
    </FormActions>
  </form>
{/if}

<style>
  form {
    display: grid;
    gap: var(--space-4);
    min-inline-size: 0;
  }

  .pending-target {
    color: var(--color-text-primary);
    overflow-wrap: anywhere;
  }
</style>
