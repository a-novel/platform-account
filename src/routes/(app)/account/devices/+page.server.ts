import { textValue } from "#lib/application/auth/forms.js";
import { requireAuthorization, rethrowRefusal } from "#lib/server/auth/authorization.js";
import { serviceFeedback } from "#lib/server/service-fetch.js";

import { devicesData } from "../../dependencies";
import type { PageServerLoadEvent } from "./$types";
import type { AccountDevice, AccountDevicesModel } from "./controller.svelte";
import { readDeviceName } from "./user-agent";

import { isHttpStatusError } from "@a-novel-kit/nodelib-browser/http";
import {
  type AuthenticationApi,
  type Session,
  sessionDelete,
  sessionDeleteLoggedOut,
  sessionList,
  sessionRevoke,
  sessionRevokeOthers,
} from "@a-novel/service-authentication-rest";

import type { RequestEvent } from "@sveltejs/kit";
import { fail, isHttpError, isRedirect } from "@sveltejs/kit";

/** DevicesActionData is the result a device action returns to the page. */
export interface DevicesActionData {
  devicesAction: AccountDevicesModel["action"];
}

/** Formats a session for the device list: its browser and system, when it was last active, and where. */
function readDevice(session: Session, dates: Intl.DateTimeFormat, regions: Intl.DisplayNames): AccountDevice {
  const region = session.region ? regions.of(session.region) : undefined;
  const place = [session.city, region].filter(Boolean).join(", ");

  return {
    ...readDeviceName(session.userAgent),
    id: session.id,
    current: session.current,
    loggedOut: session.loggedOut,
    lastActiveAt: dates.format(session.lastActiveAt),
    place: place || undefined,
    ipAddress: session.ipAddress,
  };
}

/** Lists the account's devices. A failure hides only the list: the tab still renders. */
export const load = async (event: PageServerLoadEvent) => {
  event.depends(devicesData);
  const { locale } = event.locals;
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const regions = new Intl.DisplayNames(locale, { type: "region" });
  // The list doesn't wait for the layout's reads, which run beside it.
  const devices = await readDevices(event, dates, regions);
  const { credentials } = await event.parent();

  return { devices, locationConsent: credentials.status === "ready" ? credentials.locationConsent : null };
};

/** Reads the account's devices, this one first. A failed read hides only the list. */
async function readDevices(
  event: PageServerLoadEvent,
  dates: Intl.DateTimeFormat,
  regions: Intl.DisplayNames
): Promise<AccountDevicesModel["devices"]> {
  try {
    const { authentication, session } = await requireAuthorization(event);
    const sessions = await sessionList(authentication.api, session.accessToken);
    // This device leads, and the others keep the service's order, most recently active first.
    const devices = sessions
      .toSorted((a, b) => Number(b.current) - Number(a.current))
      .map((device) => readDevice(device, dates, regions));
    return { status: "ready", devices };
  } catch (error) {
    // Redirects, refusals and planned downtimes render their own pages, as the layout's do.
    if (isRedirect(error) || isHttpError(error, 403) || (isHttpError(error, 503) && error.body.downtime)) throw error;
    // The trace records the failed call.
    return { status: "unavailable" };
  }
}

/** Runs a device change for the visitor and maps its failure to the devices tab. */
async function changeDevices(
  event: RequestEvent,
  done: "logged-out" | "logged-out-others" | "removed" | "removed-all",
  change: (api: AuthenticationApi, accessToken: string) => Promise<void>
) {
  try {
    const { authentication, session } = await requireAuthorization(event);
    await change(authentication.api, session.accessToken);
  } catch (error) {
    rethrowRefusal(error);

    const { status, feedback } = serviceFeedback(error);
    return fail(status, { devicesAction: { status: "service-error", feedback } } satisfies DevicesActionData);
  }

  return { devicesAction: { status: done } } satisfies DevicesActionData;
}

/** Reads the device a form names. Authentication refuses one that is not the visitor's. */
async function namedDevice(event: RequestEvent): Promise<string | null> {
  return textValue(await event.request.formData(), "sessionID") || null;
}

/** Removes a logged-out device. One already gone, removed in another tab or purged, counts as removed. */
async function removeSession(api: AuthenticationApi, accessToken: string, id: string): Promise<void> {
  try {
    await sessionDelete(api, accessToken, { id });
  } catch (error) {
    if (!isHttpStatusError(error, 404)) throw error;
  }
}

const missingDevice = () =>
  fail(400, { devicesAction: { status: "service-error", feedback: "serviceUnavailable" } } satisfies DevicesActionData);

/** The tab's form actions. Each change checks the session again before calling the service. */
export const actions = {
  logoutDevice: async (event: RequestEvent) => {
    const id = await namedDevice(event);
    if (!id) return missingDevice();
    return await changeDevices(event, "logged-out", (api, token) => sessionRevoke(api, token, { id }));
  },
  logoutOtherDevices: (event: RequestEvent) => changeDevices(event, "logged-out-others", sessionRevokeOthers),
  removeDevice: async (event: RequestEvent) => {
    const id = await namedDevice(event);
    if (!id) return missingDevice();
    return await changeDevices(event, "removed", (api, token) => removeSession(api, token, id));
  },
  removeLoggedOutDevices: (event: RequestEvent) => changeDevices(event, "removed-all", sessionDeleteLoggedOut),
};
