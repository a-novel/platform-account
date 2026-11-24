<script lang="ts">
  import AuthenticationError from "#lib/ui/auth/AuthenticationError.svelte";
  import { submitThrough } from "#lib/ui/form-submission.js";

  import CloseLink from "../../close-link.svelte";
  import type { AccountInformationController, PictureRefusal } from "./controller.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Alert, Button, Dialog, Field, FileInput, type FileInputController, PictureFrame } from "@a-novel-kit/uikit";

  let { controller }: { controller: AccountInformationController } = $props();

  const model = $derived(controller.state.model);
  const picture = $derived(model.picture);
  const frame = $derived(controller.pictureFrame);
  const busy = $derived(picture.status === "opening" || picture.status === "saving" || picture.status === "removing");
  const framing = $derived(picture.status === "cropping" || picture.status === "saving" ? picture : undefined);
  const hasPicture = $derived(model.profile.status === "ready" && model.profile.picture !== undefined);
  const componentId = $props.id();
  const { t } = getI18nContext();

  const remove = (event: SubmitEvent) => submitThrough(event, () => controller.submitPictureRemoval());

  // The field names the file being framed, since the input empties itself after each choice.
  const files: FileInputController = {
    get state() {
      return { value: framing ? [framing.name] : [] };
    },
    setValue: () => {},
  };

  function refusalMessage(refusal: PictureRefusal): string {
    switch (refusal) {
      case "unreadable":
        return t("account.picture.refusals.unreadable");
      case "format":
        return t("account.picture.refusals.format");
      case "ratio":
        return t("account.picture.refusals.ratio");
      case "dimensions":
        return t("account.picture.refusals.dimensions");
      case "tooLarge":
        return t("account.picture.refusals.tooLarge");
    }
  }

  function choose(event: Event & { currentTarget: HTMLInputElement }) {
    const file = event.currentTarget.files?.[0];
    // The same file chosen again after a refusal still reports a change.
    event.currentTarget.value = "";
    if (file) void controller.choosePicture(file);
  }

  /**
   * Encodes the framed picture into the form's file field, then submits the form again: the second
   * submission carries the picture natively.
   */
  async function save(event: SubmitEvent) {
    const form = event.currentTarget as HTMLFormElement;
    const field = form.elements.namedItem("picture") as HTMLInputElement;
    if (field.files?.length) return;

    event.preventDefault();
    const encoded = await controller.savePicture();
    if (!encoded) return;

    const files = new DataTransfer();
    files.items.add(new File([encoded], "picture", { type: encoded.type }));
    field.files = files.files;
    form.requestSubmit();
  }
</script>

<!-- Each action is a form of its own. They sit in the dialog's actions, as every dialog's do: removing first,
     saving last. -->
{#snippet pictureActions()}
  {#if hasPicture}
    <form method="POST" action={controller.state.actions.removePicture} onsubmit={remove}>
      <Button type="submit" variant="ghost" tone="danger" disabled={busy}>
        {picture.status === "removing" ? t("account.picture.removing") : t("account.picture.remove")}
      </Button>
    </form>
  {/if}

  {#if frame}
    <form method="POST" action={controller.state.actions.picture} enctype="multipart/form-data" onsubmit={save}>
      <input type="file" name="picture" hidden />
      <Button type="submit" disabled={busy}>
        {picture.status === "saving" ? t("account.picture.saving") : t("account.picture.save")}
      </Button>
    </form>
  {/if}
{/snippet}

<Dialog
  controller={controller.editors.picture}
  title={t("account.picture.dialogTitle")}
  size="sm"
  actions={hasPicture || frame ? pictureActions : undefined}
>
  {#snippet headerActions()}
    <CloseLink
      label={t("account.closeEditor")}
      href={controller.editorHref(null)}
      onclose={controller.editors.picture.close}
    />
  {/snippet}

  <div class="picture-editor">
    {#if !controller.state.scripted}
      <Alert tone="info" title={t("account.picture.scriptRequired")} />
    {:else}
      {#if frame}
        <PictureFrame controller={frame} label={t("account.picture.frameLabel")} shape="circle" disabled={busy} />
      {/if}

      <!-- The frame above shows what was chosen, so the field needs no visible label. -->
      <Field
        controlId={`${componentId}-file`}
        hint={picture.status === "opening" ? t("account.picture.opening") : undefined}
        error={picture.status === "choosing" && picture.refusal ? refusalMessage(picture.refusal) : undefined}
      >
        {#snippet children(control)}
          <FileInput
            {...control}
            aria-label={t("account.picture.choose")}
            accept="image/*"
            disabled={busy}
            controller={files}
            onchange={choose}
            onClear={framing ? controller.discardPicture : undefined}
          />
        {/snippet}
      </Field>
    {/if}

    {#if picture.status === "service-error"}
      <AuthenticationError feedback={picture.feedback} />
    {/if}
  </div>
</Dialog>

<style>
  .picture-editor,
  form {
    display: grid;
    gap: var(--space-4);
  }
</style>
