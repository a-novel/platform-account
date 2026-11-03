import type { AccountDevice, AccountDevicesModel } from "#lib/application/auth/types.js";
import { requireAuthorization } from "#lib/server/auth/authorization.js";

import type { PageServerLoadEvent } from "./$types";
import { readDeviceName } from "./user-agent";

import { isHttpStatusError } from "@a-novel-kit/nodelib-browser/http";
import {
  type AuthenticationApi,
  type Session,
  sessionDelete,
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
  const { locale } = event.locals;
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const regions = new Intl.DisplayNames(locale, { type: "region" });
  const { credentials } = await event.parent();
  const locationConsent = credentials.status === "ready" ? credentials.locationConsent : null;

  try {
    const { authentication, session } = await requireAuthorization(event);
    const sessions = await sessionList(authentication.api, session.accessToken);
    const devices = sessions.map((device) => readDevice(device, dates, regions));
    return { devices: { status: "ready" as const, devices }, locationConsent };
  } catch (error) {
    // Redirects, refusals and planned downtimes render their own pages, as the layout's do.
    if (isRedirect(error) || isHttpError(error, 403) || (isHttpError(error, 503) && error.body.downtime)) throw error;
    // The trace records the failed call.
    return { devices: { status: "unavailable" as const }, locationConsent };
  }
};

/** Runs a device change for the visitor and maps its failure to the devices tab. */
async function changeDevices(
  event: RequestEvent,
  done: "logged-out" | "logged-out-others" | "removed",
  change: (api: AuthenticationApi, accessToken: string) => Promise<void>
) {
  try {
    const { authentication, session } = await requireAuthorization(event);
    await change(authentication.api, session.accessToken);
  } catch (error) {
    if (isRedirect(error) || isHttpError(error, 403)) throw error;

    const tooMany = isHttpStatusError(error, 429);
    const devicesAction = {
      status: "service-error",
      feedback: tooMany ? "tooManyAttempts" : "serviceUnavailable",
    } satisfies AccountDevicesModel["action"];
    return fail(tooMany ? 429 : 503, { devicesAction } satisfies DevicesActionData);
  }

  return { devicesAction: { status: done } } satisfies DevicesActionData;
}

/** Reads the device a form names. Authentication refuses one that is not the visitor's. */
async function namedDevice(event: RequestEvent): Promise<string | null> {
  const id = (await event.request.formData()).get("sessionID");
  return typeof id === "string" && id.length > 0 ? id : null;
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
    return await changeDevices(event, "removed", (api, token) => sessionDelete(api, token, { id }));
  },
};
