<script lang="ts">
  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import {
    AccessForbiddenState,
    AccessUnavailableState,
    DowntimeState,
    Link,
    PageErrorState,
    PageNotFoundState,
    StatusState,
    useMessages,
  } from "@a-novel-kit/uikit";

  let {
    status,
    homeHref,
    retryHref,
    downtime,
    authorizationRequest = false,
  }: {
    status: number;
    homeHref: string;
    retryHref: string;
    /** Set when a planned downtime stopped the services the page needs. */
    downtime?: { end: Date; timeZone: string };
    /** Set when Authentication refused an authorization request without a redirect URI to send the visitor back to. */
    authorizationRequest?: boolean;
  } = $props();
  const { t } = getI18nContext();
  // uikit ships the access and page states' copy; a name other than `t` keeps its keys out of the app's catalog.
  const uikitText = useMessages().t;
</script>

<!-- A page that needs a login shows nothing of its own: the shell's login dialog covers it. -->
{#if downtime || authorizationRequest || status !== 401}
  <div class="error-page">
    {#if downtime}
      <DowntimeState end={downtime.end} timeZone={downtime.timeZone} headingLevel={1}>
        {#snippet actions()}
          <Link href={homeHref}>{uikitText("access.home")}</Link>
        {/snippet}
      </DowntimeState>
    {:else if authorizationRequest}
      <StatusState
        tone="error"
        title={t("access.authorizationRequest.title")}
        description={t("access.authorizationRequest.description")}
        headingLevel={1}
      >
        {#snippet actions()}
          <Link href={homeHref}>{uikitText("access.home")}</Link>
        {/snippet}
      </StatusState>
    {:else if status === 403}
      <AccessForbiddenState {homeHref} headingLevel={1} />
    {:else if status === 503}
      <AccessUnavailableState {retryHref} headingLevel={1} />
    {:else if status === 404}
      <PageNotFoundState {homeHref} headingLevel={1} />
    {:else}
      <PageErrorState {homeHref} headingLevel={1} />
    {/if}
  </div>
{/if}

<style>
  .error-page {
    display: grid;
    place-items: center;
    box-sizing: border-box;
    padding: var(--space-6);
    min-block-size: 100dvb;
  }
</style>
