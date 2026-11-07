<script module lang="ts">
  import type { Locale } from "#lib/i18n/config.js";

  import type { SelectController } from "@a-novel-kit/uikit";

  /** A language the visitor can choose: one the app supports, or their browser's. */
  export type LanguageChoice = Locale | "browser";

  /** Props for the pure "Preferences" tab. */
  export interface AccountPreferencesScreenProps {
    /** The language chosen in the form, which saving keeps for this device. */
    language: SelectController<LanguageChoice>;
    /** Where the language form posts. */
    languageAction?: string;
  }
</script>

<script lang="ts">
  import { localeNames, supportedLocales } from "#lib/i18n/config.js";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Button, Card, Field, FormActions, Select } from "@a-novel-kit/uikit";

  let { language, languageAction = "?/language" }: AccountPreferencesScreenProps = $props();

  const componentId = $props.id();
  const { t } = getI18nContext();

  // Each language reads in its own words, so a reader lost in another one still finds theirs.
  const options = $derived([
    { value: "browser" as const, label: t("preferences.language.browser") },
    ...supportedLocales.map((locale) => ({ value: locale, label: localeNames[locale] })),
  ]);
</script>

<section class="group" aria-labelledby={`${componentId}-device`}>
  <div class="heading">
    <h2 id={`${componentId}-device`}>{t("preferences.device.title")}</h2>
    <p>{t("preferences.device.description")}</p>
  </div>
  <Card surface="raised">
    <!-- Saving reloads the page in the chosen language, so the choice waits for the button. -->
    <form method="POST" action={languageAction}>
      <Field controlId={`${componentId}-language`} label={t("preferences.language.title")}>
        {#snippet children(control)}
          <Select {...control} name="language" {options} controller={language} />
        {/snippet}
      </Field>
      <FormActions>
        <Button type="submit">{t("preferences.language.save")}</Button>
      </FormActions>
    </form>
  </Card>
</section>

<style>
  .group,
  .heading,
  form {
    display: grid;
    gap: var(--space-3);
  }

  .heading {
    gap: var(--space-1);
  }

  form {
    gap: var(--space-4);
  }

  h2 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-xl);
    font-family: var(--font-family-display);
  }

  p {
    margin: 0;
    color: var(--color-text-secondary);
    line-height: var(--line-height-normal);
  }
</style>
