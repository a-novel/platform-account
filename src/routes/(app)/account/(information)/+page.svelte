<script lang="ts">
  import type { AccountEditor } from "#lib/application/auth/types.js";
  import { afterNavigate, goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import { addressBar, dialogUrl, editorParameter, localHref } from "../url-state";
  import { createInformationModel, mergeAccountAction } from "./account-action";
  import { createAccountInformationController } from "./controller.svelte";
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

  /** The URL with the editor open or closed, built on the address bar so the shell's own state stays. */
  const editorUrl = (editor: AccountEditor | null) => dialogUrl(addressBar(page.url), editorParameter, editor);

  // The address bar, which shallow routing changes without a navigation that page.url would follow.
  let currentHref = $state(page.url.href);
  const controller = createAccountInformationController({
    getModel: () => mergeAccountAction(createInformationModel(data.credentials, data.profile, null), form),
    getEditor: () => readEditor(new URL(currentHref).searchParams),
    actions,
    devicesHref: resolve("/(app)/account/devices"),
    logoutOthersHref: `${resolve("/(app)/account/devices")}?confirm=others`,
    onEditorChange: showEditor,
    editorUrl: (editor) => localHref(editorUrl(editor)),
  });

  /** Shows an editor in the URL. Opening one adds a history entry, so Back closes it. Closing replaces the entry. */
  function showEditor(editor: AccountEditor | null) {
    const next = editorUrl(editor);
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- Shallow routing edits the current, resolved URL.
    goto(next, { shallow: true, replace: editor === null, state: page.state });
    currentHref = next.href;
  }

  /** Reads the editor the address bar names, after Back, Forward or a navigation from a link. */
  function synchronizeUrl() {
    currentHref = window.location.href;
  }

  afterNavigate(({ shallow }) => {
    if (!shallow) synchronizeUrl();
  });

  onMount(() => {
    controller.enableScripts();
    window.addEventListener("popstate", synchronizeUrl);
    return () => window.removeEventListener("popstate", synchronizeUrl);
  });
</script>

<Screen {controller} />
