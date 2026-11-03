<script module lang="ts">
  /** Props for the welcome page an anonymous visitor sees. */
  export interface HomeScreenProps {
    /** Opens the login dialog, then returns to the account page. */
    loginHref: string;
  }
</script>

<script lang="ts">
  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Button, StatusState } from "@a-novel-kit/uikit";

  let { loginHref }: HomeScreenProps = $props();
  const { t } = getI18nContext();
</script>

<div class="home">
  <StatusState title={t("home.title")} description={t("home.description")} headingLevel={1}>
    {#snippet actions()}
      <Button href={loginHref}>{t("shell.signIn")}</Button>
    {/snippet}
  </StatusState>
</div>

<style>
  /* Fills the height under the header, so the welcome sits in its middle. */
  .home {
    display: grid;
    flex: 1;
    place-items: center;
    box-sizing: border-box;
    padding: var(--space-6);
  }
</style>
