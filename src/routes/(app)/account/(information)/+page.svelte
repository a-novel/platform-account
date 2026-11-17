<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import { dialogUrl, editorParameter, localHref } from "../url-state";
  import { createInformationModel, mergeAccountAction } from "./account-action";
  import { type AccountEditor, createAccountInformationController } from "./controller.svelte";
  import { readEditor } from "./editor-state";
  import Screen from "./screen.svelte";

  import { onMount } from "svelte";

  let { data, form } = $props();
  // An editor's form posts to a URL that keeps it open, so its result shows in the dialog.
  const actions = {
    password: "?edit=password&/password",
    email: "?edit=email&/email",
    cancelEmail: "?/cancelEmail",
    username: "?edit=username&/username",
    picture: "?edit=picture&/picture",
    removePicture: "?edit=picture&/removePicture",
  };

  // The address bar: the URL of the latest shallow navigation, which Back and Forward restore, until a full one.
  const url = $derived(new URL((page.shallow?.url ?? page.url).href));
  /** The URL with the editor open or closed, built on the address bar so the shell's own state stays. */
  const editorUrl = (editor: AccountEditor | null) => dialogUrl(url, editorParameter, editor);
  const controller = createAccountInformationController({
    getModel: () => mergeAccountAction(createInformationModel(data.credentials, data.profile, null), form),
    getEditor: () => readEditor(url.searchParams),
    actions,
    devicesHref: resolve("/(app)/account/devices"),
    logoutOthersHref: `${resolve("/(app)/account/devices")}?confirm=others`,
    onEditorChange: showEditor,
    editorUrl: (editor) => localHref(editorUrl(editor)),
  });

  /** Shows an editor in the URL. Opening one adds a history entry, so Back closes it. Closing replaces the entry. */
  function showEditor(editor: AccountEditor | null) {
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- Shallow routing edits the current, resolved URL.
    goto(editorUrl(editor), { shallow: true, replace: editor === null, state: page.state });
  }

  onMount(() => controller.enableScripts());
</script>

<Screen {controller} />
