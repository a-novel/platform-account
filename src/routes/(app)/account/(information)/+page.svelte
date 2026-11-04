<script lang="ts">
  import type { AccountEditor } from "#lib/application/auth/types.js";
  import { afterNavigate, goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import { addressBar, dialogUrl, localHref } from "../url-state";
  import { createInformationModel, mergeAccountAction } from "./account-action";
  import { createAccountInformationController } from "./controller.svelte";
  import { editorParameter, readEditor } from "./editor-state";
  import Screen from "./screen.svelte";

  import { onMount, untrack } from "svelte";

  let { data, form } = $props();
  // An editor's form posts to a URL that keeps it open, so its result shows in the dialog.
  const actions = {
    password: "?edit=password&/password",
    email: "?edit=email&/email",
  };

  /** The URL with the editor open or closed, built on the address bar so the shell's own state stays. */
  const editorUrl = (editor: AccountEditor | null) => dialogUrl(addressBar(page.url), editorParameter, editor);

  const model = () => mergeAccountAction(createInformationModel(data.credentials, null), form);

  const controller = createAccountInformationController({
    model: untrack(() => ({ ...model(), editor: readEditor(new URL(page.url.href).searchParams) })),
    actions,
    devicesHref: resolve("/(app)/account/devices"),
    logoutOthersHref: `${resolve("/(app)/account/devices")}?confirm=others`,
    // Opening an editor adds a history entry, so Back closes it. Closing replaces the entry.
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- Shallow routing edits the current, resolved URL.
    onEditorChange: (editor) => goto(editorUrl(editor), { shallow: true, replace: editor === null, state: page.state }),
    editorUrl: (editor) => localHref(editorUrl(editor)),
  });

  $effect(() => {
    const next = model();
    untrack(() => controller.synchronize({ ...next, editor: controller.state.model.editor }));
  });

  /** Opens the editor the address bar names, after Back, Forward or a navigation from a link. */
  function synchronizeEditor() {
    const editor = readEditor(new URL(window.location.href).searchParams);
    controller.synchronize({ ...controller.state.model, editor });
  }

  afterNavigate(({ shallow }) => {
    if (!shallow) synchronizeEditor();
  });

  onMount(() => {
    window.addEventListener("popstate", synchronizeEditor);
    return () => window.removeEventListener("popstate", synchronizeEditor);
  });
</script>

<Screen {controller} />
