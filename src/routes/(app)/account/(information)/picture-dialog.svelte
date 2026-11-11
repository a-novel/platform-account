<script lang="ts">
  import type { PictureRefusal } from "#lib/application/profile/types.js";
  import AuthenticationError from "#lib/ui/auth/AuthenticationError.svelte";
  import { submitThrough } from "#lib/ui/form-submission.js";

  import { followInPlace } from "../../link-transition";
  import type { AccountInformationController } from "./controller.svelte";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import {
    Alert,
    Button,
    Dialog,
    Field,
    FileInput,
    type FileInputController,
    IconButton,
    PictureFrame,
  } from "@a-novel-kit/uikit";

  import { X } from "@lucide/svelte";

  let { controller }: { controller: AccountInformationController } = $props();

  const model = $derived(controller.state.model);
  const picture = $derived(model.picture);
  const frame = $derived(controller.pictureFrame);
  const busy = $derived(picture.status === "opening" || picture.status === "saving" || picture.status === "removing");
  const framing = $derived(picture.status === "cropping" || picture.status === "saving" ? picture : undefined);
  const hasPicture = $derived(model.profile.status === "ready" && model.profile.picture !== undefined);
  const componentId = $props.id();
  const { t } = getI18nContext();

  const close = (event: MouseEvent) => followInPlace(event, controller.editors.picture.close);
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
        return t("authUi.account.picture.refusals.unreadable");
      case "format":
        return t("authUi.account.picture.refusals.format");
      case "ratio":
        return t("authUi.account.picture.refusals.ratio");
      case "dimensions":
        return t("authUi.account.picture.refusals.dimensions");
      case "tooLarge":
        return t("authUi.account.picture.refusals.tooLarge");
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

<Dialog controller={controller.editors.picture} title={t("authUi.account.picture.dialogTitle")} size="sm">
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

  <div class="picture-editor">
    {#if !controller.state.scripted}
      <Alert tone="info" title={t("authUi.account.picture.scriptRequired")} />
    {:else}
      {#if frame}
        <PictureFrame
          controller={frame}
          label={t("authUi.account.picture.frameLabel")}
          shape="circle"
          disabled={busy}
        />
      {/if}

      <!-- The frame above shows what was chosen, so the field needs no visible label. -->
      <Field
        controlId={`${componentId}-file`}
        hint={picture.status === "opening" ? t("authUi.account.picture.opening") : undefined}
        error={picture.status === "choosing" && picture.refusal ? refusalMessage(picture.refusal) : undefined}
      >
        {#snippet children(control)}
          <FileInput
            {...control}
            aria-label={t("authUi.account.picture.choose")}
            accept="image/*"
            disabled={busy}
            controller={files}
            onchange={choose}
            onclear={framing ? controller.discardPicture : undefined}
          />
        {/snippet}
      </Field>
    {/if}

    {#if picture.status === "service-error"}
      <AuthenticationError feedback={picture.feedback} />
    {/if}

    {#if frame}
      <form method="POST" action={controller.state.actions.picture} enctype="multipart/form-data" onsubmit={save}>
        <input type="file" name="picture" hidden />
        <Button type="submit" disabled={busy}>
          {picture.status === "saving" ? t("authUi.account.picture.saving") : t("authUi.account.picture.save")}
        </Button>
      </form>
    {/if}

    {#if hasPicture}
      <form method="POST" action={controller.state.actions.removePicture} onsubmit={remove}>
        <Button type="submit" variant="ghost" tone="danger" disabled={busy}>
          {picture.status === "removing" ? t("authUi.account.picture.removing") : t("authUi.account.picture.remove")}
        </Button>
      </form>
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
