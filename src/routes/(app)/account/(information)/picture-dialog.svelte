<script lang="ts">
  import type { PictureRefusal } from "#lib/application/profile/types.js";
  import AuthenticationError from "#lib/ui/auth/AuthenticationError.svelte";
  import { submitThrough } from "#lib/ui/form-submission.js";

  import { followInPlace } from "../../link-transition";
  import type { AccountInformationController } from "./controller.svelte";
  import { imagePlacement, maxZoom } from "./crop";

  import type { Attachment } from "svelte/attachments";

  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";
  import { Alert, Button, Dialog, Field, FileInput, IconButton, Slider } from "@a-novel-kit/uikit";

  import { X } from "@lucide/svelte";

  let { controller }: { controller: AccountInformationController } = $props();

  const model = $derived(controller.state.model);
  const picture = $derived(model.picture);
  const framing = $derived(picture.status === "cropping" || picture.status === "saving" ? picture : null);
  const placement = $derived(framing && imagePlacement(framing.source, framing.crop));
  const busy = $derived(picture.status === "opening" || picture.status === "saving" || picture.status === "removing");
  const hasPicture = $derived(model.profile.status === "ready" && model.profile.picture !== undefined);
  const componentId = $props.id();
  const { t } = getI18nContext();

  /** The share of the frame an arrow key moves the image by, and the factor a + or - key zooms by. */
  const keyStep = 0.05;
  const keyZoom = 1.1;

  const close = (event: MouseEvent) => followInPlace(event, controller.editors.picture.close);
  const remove = (event: SubmitEvent) => submitThrough(event, () => controller.submitPictureRemoval());

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

  // ---- Framing gestures: a pointer drags, two pointers pinch, the wheel and the keyboard zoom ----

  // The pointers on the frame are a gesture's bookkeeping, which nothing renders.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const pointers = new Map<number, { x: number; y: number }>();

  /** Reads a point of the viewport as fractions of the frame's side. */
  function framePoint(frame: HTMLElement, point: { x: number; y: number }) {
    const box = frame.getBoundingClientRect();
    return { x: (point.x - box.left) / box.width, y: (point.y - box.top) / box.height, side: box.width };
  }

  function grab(event: PointerEvent) {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function drag(event: PointerEvent) {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const frame = event.currentTarget as HTMLElement;
    const next = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, next);

    const other = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
    if (!other) {
      const { side } = framePoint(frame, next);
      controller.panPicture((next.x - previous.x) / side, (next.y - previous.y) / side);
      return;
    }

    const spread =
      Math.hypot(next.x - other.x, next.y - other.y) / Math.hypot(previous.x - other.x, previous.y - other.y);
    const focus = framePoint(frame, { x: (next.x + other.x) / 2, y: (next.y + other.y) / 2 });
    controller.zoomPicture(controller.pictureZoom.state.value * spread, focus.x, focus.y);
  }

  function release(event: PointerEvent) {
    pointers.delete(event.pointerId);
  }

  function press(event: KeyboardEvent) {
    const zoom = controller.pictureZoom.state.value;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => controller.panPicture(-keyStep, 0),
      ArrowRight: () => controller.panPicture(keyStep, 0),
      ArrowUp: () => controller.panPicture(0, -keyStep),
      ArrowDown: () => controller.panPicture(0, keyStep),
      "+": () => controller.zoomPicture(zoom * keyZoom),
      "=": () => controller.zoomPicture(zoom * keyZoom),
      "-": () => controller.zoomPicture(zoom / keyZoom),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  }

  /** Zooms on the wheel around the pointer. Svelte listens to the wheel passively, which cannot keep the page still. */
  const wheelZoom: Attachment<HTMLElement> = (frame) => {
    function zoom(event: WheelEvent) {
      event.preventDefault();
      const focus = framePoint(frame, { x: event.clientX, y: event.clientY });
      controller.zoomPicture(controller.pictureZoom.state.value * Math.exp(-event.deltaY / 500), focus.x, focus.y);
    }
    frame.addEventListener("wheel", zoom, { passive: false });
    return () => frame.removeEventListener("wheel", zoom);
  };
</script>

<Dialog
  controller={controller.editors.picture}
  title={t("authUi.account.picture.dialogTitle")}
  description={controller.state.scripted ? t("authUi.account.picture.description") : undefined}
  size="sm"
>
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
      {#if framing && placement}
        <!-- The application role is the ARIA one for a focusable area with its own keys and gestures,
             which no widget role describes: arrows move the image, + and - zoom it. -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
        <div
          class="frame"
          role="application"
          tabindex="0"
          aria-label={t("authUi.account.picture.frameLabel")}
          aria-describedby={`${componentId}-instructions`}
          aria-disabled={framing.status === "saving"}
          onpointerdown={grab}
          onpointermove={drag}
          onpointerup={release}
          onpointercancel={release}
          onkeydown={press}
          {@attach wheelZoom}
        >
          <img
            src={framing.source.url}
            alt=""
            draggable="false"
            style:--image-width={`${placement.width}%`}
            style:--image-left={`${placement.left}%`}
            style:--image-top={`${placement.top}%`}
          />
          <span class="mask" aria-hidden="true"></span>
        </div>
        <p id={`${componentId}-instructions`} class="instructions">{t("authUi.account.picture.frameInstructions")}</p>
        <Slider
          label={t("authUi.account.picture.zoom")}
          controller={controller.pictureZoom}
          min={1}
          max={maxZoom}
          step={0.01}
          showValue={false}
          disabled={busy}
        />
      {/if}

      <Field
        controlId={`${componentId}-file`}
        label={framing ? t("authUi.account.picture.chooseAnother") : t("authUi.account.picture.choose")}
        hint={picture.status === "opening" ? t("authUi.account.picture.opening") : undefined}
        error={picture.status === "choosing" && picture.refusal ? refusalMessage(picture.refusal) : undefined}
      >
        {#snippet children(control)}
          <FileInput {...control} accept="image/*" disabled={busy} onchange={choose} />
        {/snippet}
      </Field>
    {/if}

    {#if picture.status === "service-error"}
      <AuthenticationError feedback={picture.feedback} />
    {/if}

    {#if framing}
      <form method="POST" action={controller.state.actions.picture} enctype="multipart/form-data" onsubmit={save}>
        <input type="file" name="picture" hidden />
        <Button type="submit" disabled={busy}>
          {framing.status === "saving" ? t("authUi.account.picture.saving") : t("authUi.account.picture.save")}
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

  /* The square shows what the picture keeps; the round mask previews how Agora shows it. */
  .frame {
    position: relative;
    justify-self: center;
    cursor: grab;
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);
    aspect-ratio: 1;
    inline-size: min(100%, 20rem);
    overflow: hidden;
    touch-action: none;
    user-select: none;
  }

  .frame:active {
    cursor: grabbing;
  }

  .frame:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus-ring);
  }

  .frame[aria-disabled="true"] {
    pointer-events: none;
  }

  /* The image sits on physical edges: it frames the same square in every writing direction. */
  img {
    position: absolute;
    top: var(--image-top);
    left: var(--image-left);
    width: var(--image-width);
    max-inline-size: none;
    block-size: auto;
  }

  .mask {
    position: absolute;
    inset: 0;
    box-shadow: 0 0 0 100vmax var(--color-overlay-backdrop);
    border-radius: var(--radius-round);
  }

  .instructions {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-normal);
  }
</style>
