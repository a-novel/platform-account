<script module lang="ts">
  import type { AccountScreenController } from "./controller.svelte";

  /** Props for the pure protected account-management screen. */
  export interface AccountScreenProps {
    controller: AccountScreenController;
  }
</script>

<script lang="ts">
  import type { AccountPasswordField } from "#lib/application/auth/types.js";
  import { translateAuthenticationFeedback, translateFieldIssue } from "#lib/i18n/auth-feedback.js";
  import AuthenticationError from "#lib/ui/auth/AuthenticationError.svelte";
  import { submitThrough } from "#lib/ui/form-submission.js";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import {
    Alert,
    Badge,
    Button,
    Card,
    Container,
    Field,
    FormActions,
    Input,
    PageHeader,
    PasswordInput,
    Stack,
  } from "@a-novel-kit/uikit";

  import { Hourglass, ShieldCheck } from "@lucide/svelte";

  let { controller }: AccountScreenProps = $props();

  const model = $derived(controller.state.model);
  const actions = $derived(controller.state.actions);

  const componentId = $props.id();
  const { t } = getI18nContext();

  const currentPasswordId = `${componentId}-current-password`;
  const newPasswordId = `${componentId}-new-password`;
  const confirmPasswordId = `${componentId}-confirm-password`;
  const currentEmailId = `${componentId}-current-email`;
  const newEmailId = `${componentId}-new-email`;
  const emailCurrentPasswordId = `${componentId}-email-current-password`;

  const passwordSubmitting = $derived(model.passwordState.status === "submitting");
  const emailSubmitting = $derived(model.emailState.status === "submitting");
  const loggingOut = $derived(model.logoutState === "submitting");
  const passwordIssues = $derived(model.passwordState.status === "validation-error" ? model.passwordState.issues : []);
  const emailIssues = $derived(model.emailState.status === "validation-error" ? model.emailState.issues : []);

  const passwordError = (field: AccountPasswordField) => translateFieldIssue(t, passwordIssues, field);
  const submitPassword = (event: SubmitEvent) => submitThrough(event, (form) => controller.submitPassword(form));
  const submitEmail = (event: SubmitEvent) => submitThrough(event, (form) => controller.submitEmail(form));

  function submitLogout(event: SubmitEvent) {
    if (!controller.submitLogout()) event.preventDefault();
  }
</script>

<div class="account-screen">
  <Container size="sm" gutter={false}>
    <Stack gap="4">
      <PageHeader title={t("authUi.account.title")} description={t("authUi.account.description")} />

      <Stack gap="4">
        <Card surface="raised">
          <section id="account-password" class="card-section" aria-labelledby={`${componentId}-password-title`}>
            <header class="section-heading">
              <h2 id={`${componentId}-password-title`}>{t("authUi.account.password.title")}</h2>
            </header>

            <form
              method="POST"
              action={actions.password}
              aria-busy={passwordSubmitting}
              novalidate
              onsubmit={submitPassword}
            >
              <Field
                controlId={currentPasswordId}
                label={t("authUi.account.password.currentLabel")}
                error={passwordError("currentPassword")}
                required
              >
                {#snippet children(control)}
                  <PasswordInput
                    {...control}
                    controller={controller.passwordVisibility.currentPassword}
                    name="currentPassword"
                    autocomplete="current-password"
                    readonly={passwordSubmitting}
                  />
                {/snippet}
              </Field>
              <Field
                controlId={newPasswordId}
                label={t("authUi.account.password.newLabel")}
                hint={t("authUi.passwordHint")}
                error={passwordError("newPassword")}
                required
              >
                {#snippet children(control)}
                  <PasswordInput
                    {...control}
                    controller={controller.passwordVisibility.newPassword}
                    name="password"
                    autocomplete="new-password"
                    readonly={passwordSubmitting}
                  />
                {/snippet}
              </Field>
              <Field
                controlId={confirmPasswordId}
                label={t("authUi.account.password.confirmLabel")}
                error={passwordError("confirmPassword")}
                required
              >
                {#snippet children(control)}
                  <PasswordInput
                    {...control}
                    controller={controller.passwordVisibility.confirmPassword}
                    name="confirmPassword"
                    autocomplete="new-password"
                    readonly={passwordSubmitting}
                  />
                {/snippet}
              </Field>
              <FormActions>
                {#snippet feedback()}
                  {#if model.passwordState.status === "service-error"}
                    <AuthenticationError feedback={model.passwordState.feedback} />
                  {:else if model.passwordState.status === "success"}
                    <Alert tone="success" title={translateAuthenticationFeedback(t, model.passwordState.feedback)} />
                  {/if}
                {/snippet}
                <Button type="submit" disabled={passwordSubmitting}>
                  {passwordSubmitting ? t("authUi.account.password.submitting") : t("authUi.account.password.submit")}
                </Button>
              </FormActions>
            </form>
          </section>
        </Card>

        <Card surface="raised">
          <section id="account-email" class="card-section" aria-labelledby={`${componentId}-email-title`}>
            <header class="section-heading">
              <h2 id={`${componentId}-email-title`}>{t("authUi.account.email.title")}</h2>
              <p>{t("authUi.account.email.description")}</p>
            </header>

            {#if model.credentials.status === "ready"}
              {@const email = model.credentials.email}
              <Field controlId={currentEmailId} label={t("authUi.account.email.current")}>
                {#snippet children(control)}
                  <Input {...control} type="email" value={email} readonly />
                {/snippet}
              </Field>
              {#if model.credentials.pendingEmail}
                {@const pending = model.credentials.pendingEmail}
                <!-- Stored state rather than feedback, so a note: the form's status already announces a new link. -->
                <Alert tone="warning" role="note" title={t("authUi.account.email.pending")}>
                  {#snippet icon()}
                    <Hourglass size="var(--icon-size-sm)" />
                  {/snippet}
                  <span class="pending-email">{pending.email}</span>
                  {t("authUi.account.email.pendingExpiry", { date: pending.expiresAt })}
                </Alert>
              {/if}
            {:else}
              <Alert tone="error" title={t("authUi.account.email.unavailable")} />
            {/if}

            <form method="POST" action={actions.email} aria-busy={emailSubmitting} novalidate onsubmit={submitEmail}>
              <Field
                controlId={newEmailId}
                label={t("authUi.account.email.label")}
                hint={t("authUi.account.email.hint")}
                error={translateFieldIssue(t, emailIssues, "newEmail")}
                required
              >
                {#snippet children(control)}
                  <Input
                    {...control}
                    name="email"
                    type="email"
                    autocomplete="email"
                    autocapitalize="none"
                    spellcheck="false"
                    readonly={emailSubmitting}
                  />
                {/snippet}
              </Field>
              <Field
                controlId={emailCurrentPasswordId}
                label={t("authUi.account.password.currentLabel")}
                error={translateFieldIssue(t, emailIssues, "currentPassword")}
                required
              >
                {#snippet children(control)}
                  <PasswordInput
                    {...control}
                    controller={controller.passwordVisibility.emailCurrentPassword}
                    name="currentPassword"
                    autocomplete="current-password"
                    readonly={emailSubmitting}
                  />
                {/snippet}
              </Field>
              <FormActions>
                {#snippet feedback()}
                  {#if model.emailState.status === "service-error"}
                    <AuthenticationError feedback={model.emailState.feedback} />
                  {:else if model.emailState.status === "pending-email"}
                    <Alert tone="success" title={t("authUi.account.email.pendingTitle")}>
                      {t("authUi.account.email.pendingDescription")}
                    </Alert>
                  {/if}
                {/snippet}
                <Button type="submit" disabled={emailSubmitting}>
                  {#if emailSubmitting}
                    {t("authUi.account.email.submitting")}
                  {:else if model.emailState.status === "pending-email"}
                    {t("authUi.account.email.resend")}
                  {:else}
                    {t("authUi.account.email.submit")}
                  {/if}
                </Button>
              </FormActions>
            </form>
          </section>
        </Card>

        <section id="account-claims" class="session-summary" aria-labelledby={`${componentId}-claims-title`}>
          <div class="section-heading">
            <ShieldCheck size="var(--icon-size-md)" aria-hidden="true" />
            <h2 id={`${componentId}-claims-title`}>{t("authUi.account.claims.title")}</h2>
          </div>

          {#if model.claims.status === "loading"}
            <Alert tone="loading" title={t("authUi.account.loadingTitle")} />
          {:else if model.claims.status === "error"}
            <Alert tone="error" title={t("authUi.account.loadErrorTitle")}>
              {translateAuthenticationFeedback(t, model.claims.feedback)}
            </Alert>
          {:else}
            <dl class="details">
              <div class="session-identity">
                <dt>{t("authUi.account.claims.userId")}</dt>
                <dd class="monospace">{model.claims.userId}</dd>
              </div>
              <div class="session-identity">
                <dt>{t("authUi.account.claims.roles")}</dt>
                <dd>
                  <div class="roles">
                    {#each model.claims.roles as role (role)}
                      <Badge tone="brand">{role}</Badge>
                    {:else}
                      <span>{t("authUi.account.claims.noRoles")}</span>
                    {/each}
                  </div>
                </dd>
              </div>
              <div class="session-expiry">
                <dt>{t("authUi.account.claims.accessExpiresAt")}</dt>
                <dd>{model.claims.accessExpiresAt}</dd>
              </div>
              <div class="session-expiry">
                <dt>{t("authUi.account.claims.refreshExpiresAt")}</dt>
                <dd>{model.claims.refreshExpiresAt}</dd>
              </div>
            </dl>
          {/if}

          <form
            id="account-session"
            method="POST"
            action={actions.logout}
            aria-busy={loggingOut}
            onsubmit={submitLogout}
          >
            <FormActions>
              {#snippet feedback()}
                <p id={`${componentId}-logout-description`} class="feedback-message">
                  {t("authUi.account.logout.description")}
                </p>
              {/snippet}
              <Button
                type="submit"
                variant="outline"
                tone="neutral"
                aria-describedby={`${componentId}-logout-description`}
                disabled={loggingOut}
              >
                {loggingOut ? t("authUi.account.logout.submitting") : t("authUi.account.logout.submit")}
              </Button>
            </FormActions>
          </form>
        </section>
      </Stack>
    </Stack>
  </Container>
</div>

<style>
  .account-screen {
    padding-inline: var(--layout-gutter);
    padding-block: var(--space-6) var(--space-12);
  }

  .session-summary,
  .card-section,
  form {
    display: grid;
    gap: var(--space-4);
    min-inline-size: 0;
  }

  .card-section,
  .session-summary,
  #account-session {
    scroll-margin-block-start: var(--space-5);
  }

  .session-summary,
  #account-session {
    padding-block-start: var(--space-4);
  }

  .section-heading {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .section-heading > :global(svg) {
    flex: none;
    align-self: center;
    color: var(--color-text-accent);
  }

  header.section-heading {
    display: grid;
    gap: var(--space-2);
  }

  h2,
  .section-heading p,
  .feedback-message {
    margin: 0;
  }

  h2 {
    min-inline-size: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-xl);
    font-family: var(--font-family-display);
    overflow-wrap: anywhere;
  }

  .section-heading p,
  .feedback-message {
    color: var(--color-text-secondary);
    line-height: var(--line-height-normal);
  }

  .details {
    display: grid;
    gap: var(--space-4);
    margin: 0;
  }

  @media (min-width: 35rem) {
    .details {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .details > div {
    display: grid;
    align-content: start;
    gap: var(--space-1);
    min-inline-size: 0;
  }

  .session-identity {
    grid-column: 1 / -1;
  }

  .details dt {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  .details dd {
    margin: 0;
    line-height: var(--line-height-normal);
    overflow-wrap: anywhere;
  }

  .pending-email {
    display: block;
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
  }

  .roles {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .monospace {
    font-size: var(--font-size-sm);
    font-family: var(--font-family-mono);
  }

  @media (max-width: 34.999rem) {
    .account-screen {
      padding-inline: var(--space-2);
      padding-block-start: var(--space-3);
    }

    .details {
      gap: var(--space-3);
    }

    .details > .session-expiry {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: baseline;
      gap: var(--space-1) var(--space-3);
      font-size: var(--font-size-sm);
    }
  }
</style>
