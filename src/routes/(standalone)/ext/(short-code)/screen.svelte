<script module lang="ts">
  import type { ShortCodePasswordField, ShortCodeScreenController } from "./controller.svelte";

  /** Props for a pure standalone email-link completion screen. */
  interface ShortCodeScreenProps {
    controller: ShortCodeScreenController;
  }
</script>

<script lang="ts">
  import { translateAuthenticationFeedback, translateFieldIssue } from "#lib/i18n/auth-feedback.js";
  import AuthenticationError from "#lib/ui/auth/AuthenticationError.svelte";
  import { submitThrough } from "#lib/ui/form-submission.js";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Button, Card, Field, FormActions, Link, PasswordInput, StatusState } from "@a-novel-kit/uikit";

  let { controller }: ShortCodeScreenProps = $props();

  const model = $derived(controller.state.model);
  const action = $derived(controller.state.action);
  const restartHref = $derived(controller.state.restartHref);
  const continueHref = $derived(controller.state.continueHref);

  const { t } = getI18nContext();
  const componentId = $props.id();
  const newPasswordId = `${componentId}-new-password`;
  const confirmPasswordId = `${componentId}-confirm-password`;
  const submitting = $derived(model.state.status === "submitting");
  const issues = $derived(model.state.status === "validation-error" ? model.state.issues : []);
  const unavailableStatus = $derived(
    model.state.status === "missing" || model.state.status === "invalid" ? model.state.status : null
  );
  const hasOutcome = $derived(
    model.journey === "email-update" || unavailableStatus !== null || model.state.status === "success"
  );

  const fieldError = (field: ShortCodePasswordField) => translateFieldIssue(t, issues, field);
  const submit = (event: SubmitEvent) => submitThrough(event, (form) => controller.submit(form));
</script>

<main class="standalone-page">
  <section class="secure-action" aria-labelledby={hasOutcome ? undefined : `${componentId}-title`}>
    {#if !hasOutcome}
      <header class="page-heading">
        {#if model.journey === "register"}
          <h1 id={`${componentId}-title`}>{t("shortCode.journeys.register.title")}</h1>
          <p>{t("shortCode.journeys.register.description")}</p>
        {:else}
          <h1 id={`${componentId}-title`}>{t("shortCode.journeys.passwordReset.title")}</h1>
          <p>{t("shortCode.journeys.passwordReset.description")}</p>
        {/if}
      </header>
    {/if}

    {#if unavailableStatus}
      <StatusState
        tone="error"
        title={unavailableStatus === "missing"
          ? t("shortCode.states.missing.title")
          : t("shortCode.states.invalid.title")}
        headingLevel={1}
        description={unavailableStatus === "missing"
          ? t("shortCode.states.missing.description")
          : t("shortCode.states.invalid.description")}
      >
        {#snippet actions()}
          <!-- Invitations are issued by the team, so a dead one leads back to the invitation list. -->
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- The pure screen receives app-resolved URLs. -->
          <Link href={restartHref}>
            {model.journey === "register" ? t("shell.auth.createAccount") : t("shortCode.restart")}
          </Link>
        {/snippet}
      </StatusState>
    {:else if model.state.status === "success"}
      <StatusState tone="success" title={translateAuthenticationFeedback(t, model.state.feedback)} headingLevel={1}>
        {#snippet actions()}
          <!-- A password reset returns no session, so it continues to the login form. -->
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- The pure screen receives app-resolved URLs. -->
          <Link href={continueHref}>
            {model.journey === "password-reset" ? t("shell.signIn") : t("shortCode.continue")}
          </Link>
        {/snippet}
      </StatusState>
    {:else if model.journey === "email-update"}
      {#if model.state.status === "service-error"}
        <StatusState
          tone="error"
          title={t("shortCode.journeys.emailUpdate.unavailableTitle")}
          description={translateAuthenticationFeedback(t, model.state.feedback)}
          headingLevel={1}
        >
          {#snippet actions()}
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- The pure screen receives app-resolved URLs. -->
            <Link href={restartHref}>{t("shortCode.restart")}</Link>
          {/snippet}
        </StatusState>
      {:else}
        <StatusState tone="loading" title={t("shortCode.journeys.emailUpdate.submitting")} headingLevel={1} />
        <noscript>
          <form method="POST" {action}>
            <Button type="submit">{t("shortCode.journeys.emailUpdate.submit")}</Button>
          </form>
        </noscript>
      {/if}
    {:else}
      <!-- The fields carry no border, so the form sits on a card to show their edges. -->
      <Card surface="raised">
        <form method="POST" {action} aria-busy={submitting} novalidate onsubmit={submit}>
          <Field
            controlId={newPasswordId}
            label={t("shortCode.newPasswordLabel")}
            hint={t("form.passwordHint")}
            error={fieldError("newPassword")}
            required
          >
            {#snippet children(control)}
              <PasswordInput
                {...control}
                controller={controller.passwordVisibility.newPassword}
                name="password"
                autocomplete="new-password"
                readonly={submitting}
              />
            {/snippet}
          </Field>
          <Field
            controlId={confirmPasswordId}
            label={t("shortCode.confirmPasswordLabel")}
            error={fieldError("confirmPassword")}
            required
          >
            {#snippet children(control)}
              <PasswordInput
                {...control}
                controller={controller.passwordVisibility.confirmPassword}
                name="confirmPassword"
                autocomplete="new-password"
                readonly={submitting}
              />
            {/snippet}
          </Field>

          <FormActions>
            {#snippet feedback()}
              {#if model.state.status === "service-error"}
                <AuthenticationError feedback={model.state.feedback} />
              {/if}
            {/snippet}
            <Button type="submit" disabled={submitting}>
              {#if model.journey === "register"}
                {submitting ? t("shortCode.journeys.register.submitting") : t("shortCode.journeys.register.submit")}
              {:else}
                {submitting
                  ? t("shortCode.journeys.passwordReset.submitting")
                  : t("shortCode.journeys.passwordReset.submit")}
              {/if}
            </Button>
          </FormActions>
        </form>
      </Card>
    {/if}
  </section>
</main>

<style>
  .standalone-page {
    display: grid;
    box-sizing: border-box;
    padding: clamp(var(--space-4), 5vi, var(--space-12));
    min-block-size: 100dvb;
    color: var(--color-text-primary);
  }

  .secure-action,
  form {
    display: grid;
    gap: var(--space-4);
    min-inline-size: 0;
  }

  .secure-action {
    align-self: center;
    gap: var(--space-6);
    margin-inline: auto;
    inline-size: 100%;
    max-inline-size: var(--layout-readable-measure);
  }

  .page-heading {
    display: grid;
    gap: var(--space-2);
  }

  .page-heading h1,
  .page-heading p {
    margin: 0;
  }

  .page-heading h1 {
    font-size: var(--font-size-2xl);
    line-height: var(--line-height-tight);
    font-family: var(--font-family-display);
  }

  .page-heading p {
    color: var(--color-text-muted);
    line-height: var(--line-height-normal);
  }

  @media (width < 35rem) {
    .standalone-page {
      padding: var(--space-2);
    }
  }
</style>
