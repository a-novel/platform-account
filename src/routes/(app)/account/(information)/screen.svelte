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
  import PictureDialog from "./picture-dialog.svelte";
  import UsernameDialog from "./username-dialog.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Alert, Avatar, Card, IconButton, Skeleton } from "@a-novel-kit/uikit";

  import { Hourglass, Pencil } from "@lucide/svelte";

  let { controller }: AccountInformationScreenProps = $props();

  const credentials = $derived(controller.state.model.credentials);
  const profile = $derived(controller.state.model.profile);
  const componentId = $props.id();
  const { t } = getI18nContext();

  const openEditor = (editor: AccountEditor) => (event: MouseEvent) =>
    followInPlace(event, controller.editors[editor].open);
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

<div class="cards">
  <Card surface="raised">
    <section class="information" aria-labelledby={`${componentId}-profile-title`}>
      <div class="heading">
        <h2 id={`${componentId}-profile-title`}>{t("authUi.account.profile.title")}</h2>
        <p class="secondary">{t("authUi.account.profile.description")}</p>
      </div>
      <dl>
        <div>
          <dt>{t("authUi.account.username.title")}</dt>
          <dd>
            <div class="row">
              {#if profile.status === "ready" && profile.username}
                <bdi class="value">{profile.username}</bdi>
              {:else if profile.status === "ready"}
                <span class="secondary">{t("authUi.account.username.none")}</span>
              {:else}
                <Skeleton class="value-skeleton" />
              {/if}
              {@render changeButton("username", t("authUi.account.username.changeLabel"))}
            </div>
          </dd>
        </div>
        <div>
          <dt>{t("authUi.account.picture.title")}</dt>
          <dd>
            <div class="row">
              {#if profile.status === "ready" && profile.picture}
                <Avatar src={profile.picture} label={t("authUi.account.picture.current")} size="lg" />
              {:else if profile.status === "ready"}
                <span class="secondary">{t("authUi.account.picture.none")}</span>
              {:else}
                <Skeleton shape="circle" />
              {/if}
              {@render changeButton("picture", t("authUi.account.picture.changeLabel"))}
            </div>
          </dd>
        </div>
      </dl>
    </section>
  </Card>

  <!-- Each way to log in sits on a card of its own inside the credentials. -->
  <Card surface="raised">
    <section class="information" aria-labelledby={`${componentId}-credentials-title`}>
      <div class="heading">
        <h2 id={`${componentId}-credentials-title`}>{t("authUi.account.credentials.title")}</h2>
        <p class="secondary">{t("authUi.account.credentials.description")}</p>
      </div>
      <Card surface="raised">
        <section class="information" aria-labelledby={`${componentId}-title`}>
          <h3 id={`${componentId}-title`}>{t("authUi.account.signIn.title")}</h3>
          <dl>
            <div>
              <dt>{t("authUi.account.email.title")}</dt>
              <dd>
                <div class="row">
                  {#if credentials.status === "ready"}
                    <span class="value">{credentials.email}</span>
                  {:else}
                    <Skeleton class="value-skeleton" />
                  {/if}
                  {@render changeButton("email", t("authUi.account.email.changeLabel"))}
                </div>
                {#if credentials.status === "ready" && credentials.pendingEmail}
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
                  {@render changeButton("password", t("authUi.account.password.changeLabel"))}
                </div>
              </dd>
            </div>
          </dl>
        </section>
      </Card>
    </section>
  </Card>
</div>

<UsernameDialog {controller} />
<PictureDialog {controller} />
<EmailDialog {controller} />
<PasswordDialog {controller} />

<style>
  .cards {
    display: grid;
    gap: var(--space-6);
  }

  .heading {
    display: grid;
    gap: var(--space-1);
  }

  .heading p {
    margin: 0;
    font-size: var(--font-size-sm);
    line-height: var(--line-height-normal);
  }

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

  h2,
  h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-family-display);
  }

  h2 {
    font-size: var(--font-size-xl);
  }

  h3 {
    font-size: var(--font-size-lg);
  }

  dt {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
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
    font-size: var(--font-size-sm);
    overflow-wrap: anywhere;
  }
</style>
