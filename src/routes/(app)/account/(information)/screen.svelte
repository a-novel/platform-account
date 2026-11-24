<script module lang="ts">
  import type { AccountInformationController } from "./controller.svelte";

  /** Props for the pure "My information" tab. */
  interface AccountInformationScreenProps {
    controller: AccountInformationController;
  }
</script>

<script lang="ts">
  import AuthenticationError from "#lib/ui/auth/AuthenticationError.svelte";
  import { submitThrough } from "#lib/ui/form-submission.js";

  import { followInPlace } from "../../link-transition";
  import type { AccountEditor } from "./controller.svelte";
  import EmailDialog from "./email-dialog.svelte";
  import PasswordDialog from "./password-dialog.svelte";
  import PictureDialog from "./picture-dialog.svelte";
  import UsernameDialog from "./username-dialog.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Alert, Avatar, Button, Card, IconButton, Section, Skeleton } from "@a-novel-kit/uikit";

  import { Hourglass, Pencil } from "@lucide/svelte";

  let { controller }: AccountInformationScreenProps = $props();

  const credentials = $derived(controller.state.model.credentials);
  const profile = $derived(controller.state.model.profile);
  const emailCancel = $derived(controller.state.model.emailCancelState);
  const { t } = getI18nContext();

  const openEditor = (editor: AccountEditor) => (event: MouseEvent) =>
    followInPlace(event, controller.editors[editor].open);
  const cancelEmail = (event: SubmitEvent) => submitThrough(event, () => controller.submitEmailCancel());
</script>

{#snippet changeButton(editor: AccountEditor, label: string)}
  <IconButton
    {label}
    variant="ghost"
    tone="neutral"
    size="sm"
    href={controller.editorHref(editor)}
    onclick={openEditor(editor)}
  >
    <Pencil size="var(--icon-size-sm)" aria-hidden="true" />
  </IconButton>
{/snippet}

<div class="sections">
  <Section title={t("account.profile.title")} description={t("account.profile.description")}>
    <Card surface="raised">
      <dl>
        <div>
          <dt>{t("account.username.title")}</dt>
          <dd>
            <div class="row">
              {#if profile.status === "ready" && profile.username}
                <bdi class="value">{profile.username}</bdi>
              {:else if profile.status === "ready"}
                <span class="secondary">{t("account.username.none")}</span>
              {:else}
                <Skeleton class="value-skeleton" />
              {/if}
              {@render changeButton("username", t("account.username.changeLabel"))}
            </div>
          </dd>
        </div>
        <div>
          <dt>{t("account.picture.title")}</dt>
          <dd>
            <div class="row">
              {#if profile.status === "ready" && profile.picture}
                <Avatar src={profile.picture} label={t("account.picture.current")} size="lg" />
              {:else if profile.status === "ready"}
                <span class="secondary">{t("account.picture.none")}</span>
              {:else}
                <Skeleton shape="circle" />
              {/if}
              {@render changeButton("picture", t("account.picture.changeLabel"))}
            </div>
          </dd>
        </div>
      </dl>
    </Card>
  </Section>

  <!-- Each way to log in sits on a card of its own, which names it. -->
  <Section title={t("account.credentials.title")} description={t("account.credentials.description")}>
    <Card surface="raised">
      <Section title={t("account.signIn.title")}>
        <dl>
          <div>
            <dt>{t("account.email.title")}</dt>
            <dd>
              <div class="row">
                {#if credentials.status === "ready"}
                  <span class="value">{credentials.email}</span>
                {:else}
                  <Skeleton class="value-skeleton" />
                {/if}
                {@render changeButton("email", t("account.email.changeLabel"))}
              </div>
              {#if credentials.status === "ready" && credentials.pendingEmail}
                {@const pending = credentials.pendingEmail}
                <Alert tone="info" role="note" title={t("account.email.pending")}>
                  {#snippet icon()}
                    <Hourglass size="var(--icon-size-sm)" />
                  {/snippet}
                  {#snippet actions()}
                    <form method="POST" action={controller.state.actions.cancelEmail} onsubmit={cancelEmail}>
                      <Button
                        type="submit"
                        variant="text"
                        tone="neutral"
                        size="sm"
                        disabled={emailCancel.status === "submitting"}
                      >
                        {emailCancel.status === "submitting"
                          ? t("account.email.cancelling")
                          : t("account.email.cancel")}
                      </Button>
                    </form>
                  {/snippet}
                  <span class="pending-email">{pending.email}</span>
                  {t("account.email.pendingExpiry", { date: pending.expiresAt })}
                </Alert>
                {#if emailCancel.status === "service-error"}
                  <AuthenticationError feedback={emailCancel.feedback} />
                {/if}
              {/if}
            </dd>
          </div>
          <div>
            <dt>{t("account.password.title")}</dt>
            <dd>
              <div class="row">
                <span class="secondary" aria-hidden="true">••••••••</span>
                {@render changeButton("password", t("account.password.changeLabel"))}
              </div>
            </dd>
          </div>
        </dl>
      </Section>
    </Card>
  </Section>
</div>

<UsernameDialog {controller} />
<PictureDialog {controller} />
<EmailDialog {controller} />
<PasswordDialog {controller} />

<style>
  .sections {
    display: grid;
    gap: var(--space-8);
  }

  dl,
  dd,
  dl > div {
    display: grid;
    margin: 0;
    min-inline-size: 0;
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

  dt {
    color: var(--color-text-secondary);
    font: var(--text-ui);
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    min-inline-size: 0;
  }

  .row :global(.value-skeleton) {
    inline-size: 50%;
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
    font: var(--text-ui);
    overflow-wrap: anywhere;
  }
</style>
